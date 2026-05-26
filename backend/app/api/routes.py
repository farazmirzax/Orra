import json
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.payload import ExecuteRequest
from app.services.orchestrator.graph import compile_dynamic_graph
from app.core.database import get_db
from app.models.workflow import WorkflowRun, NodeLog
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Orra Execution Engine"}

@router.get("/runs")
async def list_runs(db: Session = Depends(get_db)):
    runs = db.query(WorkflowRun).order_by(WorkflowRun.created_at.desc()).limit(10).all()
    return {
        "runs": [
            {
                "run_id": run.id,
                "workflow_id": run.workflow_id,
                "initial_prompt": run.initial_prompt,
                "final_status": run.final_status,
                "created_at": run.created_at,
            }
            for run in runs
        ]
    }

@router.post("/execute")
async def execute_workflow(request: ExecuteRequest, db: Session = Depends(get_db)):
    db_run = WorkflowRun(
        workflow_id=request.workflow_id,
        initial_prompt=request.initial_prompt,
        final_status="running"
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    initial_state = {
        "initial_prompt": request.initial_prompt,
        "processed_data": "",
        "status": "pending"
    }
    
    # --- COMPILE THE GRAPH ON THE FLY ---
    dynamic_workflow = compile_dynamic_graph(request.nodes, request.edges)
    
    final_state = {}
    
    # Run the stream on our dynamically compiled workflow
    for event in dynamic_workflow.stream(initial_state):
        for node_name, state_update in event.items():
            node_log = NodeLog(
                run_id=db_run.id,
                node_name=node_name,
                state_snapshot=json.dumps(state_update)
            )
            db.add(node_log)
            final_state.update(state_update)
            
    db_run.final_status = final_state.get("status", "completed")
    db.commit()
    
    return {
        "run_id": db_run.id,
        "workflow_id": request.workflow_id,
        "final_state": final_state
    }

@router.get("/runs/{run_id}")
async def get_run_logs(run_id: int, db: Session = Depends(get_db)):
    # Fetch the main run
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        return {"error": "Run not found"}
        
    # Fetch all logs for this run, ordered by when they were created
    logs = db.query(NodeLog).filter(NodeLog.run_id == run_id).order_by(NodeLog.created_at.asc()).all()
    
    return {
        "run_id": run.id,
        "workflow_id": run.workflow_id,
        "final_status": run.final_status,
        "execution_steps": [
            {
                "step_id": log.id,
                "node": log.node_name,
                "state_snapshot": json.loads(log.state_snapshot), # Convert back to JSON object
                "timestamp": log.created_at
            }
            for log in logs
        ]
    }

@router.post("/execute-stream")
async def execute_workflow_stream(request: ExecuteRequest, db: Session = Depends(get_db)):
    db_run = WorkflowRun(
        workflow_id=request.workflow_id,
        initial_prompt=request.initial_prompt,
        final_status="running"
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    # 1. Compile the graph on the fly
    dynamic_workflow = compile_dynamic_graph(request.nodes, request.edges)
    
    initial_state = {
        "initial_prompt": request.initial_prompt,
        "processed_data": "",
        "status": "pending"
    }

    # 2. Create an async generator that yields data piece-by-piece
    async def event_generator():
        def sse_payload(payload: dict):
            payload["timestamp"] = datetime.now(timezone.utc).isoformat()
            return f"data: {json.dumps(payload)}\n\n"

        def persist_log(node_name: str, payload: dict):
            node_log = NodeLog(
                run_id=db_run.id,
                node_name=node_name,
                state_snapshot=json.dumps(payload)
            )
            db.add(node_log)
            db.commit()

        workflow_started = {
            "type": "workflow_started",
            "run_id": db_run.id,
            "nodes": [node.id for node in request.nodes],
            "workflow": {
                "nodes": [
                    {
                        "id": node.id,
                        "label": node.label,
                        "system_prompt": node.system_prompt,
                        "x": node.x,
                        "y": node.y,
                    }
                    for node in request.nodes
                ],
                "edges": [
                    {
                        "source": edge.source,
                        "target": edge.target,
                    }
                    for edge in request.edges
                ],
            },
        }
        persist_log("__workflow__", workflow_started)
        yield sse_payload(workflow_started)

        final_state = {}
        has_failure = False

        # Stream the LangGraph execution
        for event in dynamic_workflow.stream(initial_state):
            for node_name, state_update in event.items():

                node_label = next((node.label for node in request.nodes if node.id == node_name), node_name)

                node_started = {
                    "type": "node_started",
                    "run_id": db_run.id,
                    "node": node_name,
                    "node_label": node_label,
                }
                persist_log(node_name, node_started)
                yield sse_payload(node_started)

                await asyncio.sleep(0.05)

                node_finished = {
                    "type": "node_failed" if state_update.get("error") else "node_completed",
                    "run_id": db_run.id,
                    "node": node_name,
                    "node_label": node_label,
                    "data": state_update.get("processed_data", ""),
                    "duration_ms": state_update.get("duration_ms"),
                    "input_text": state_update.get("input_text", ""),
                    "output_text": state_update.get("output_text", ""),
                    "error": state_update.get("error"),
                    "retry_count": state_update.get("retry_count", 0),
                }
                if state_update.get("error"):
                    has_failure = True

                persist_log(node_name, {**node_finished, "state": state_update})
                final_state.update(state_update)
                yield sse_payload(node_finished)

                # Tiny artificial delay just so the visual effect looks incredibly smooth
                await asyncio.sleep(0.2) 

        db_run.final_status = "failed" if has_failure else final_state.get("status", "completed")
        db.commit()

        workflow_completed = {
            "type": "workflow_completed",
            "run_id": db_run.id,
            "final_status": db_run.final_status,
        }
        persist_log("__workflow__", workflow_completed)
        yield sse_payload(workflow_completed)

        # Tell the frontend we are finished
        yield "data: [DONE]\n\n"

    # 3. Return the streaming response
    return StreamingResponse(event_generator(), media_type="text/event-stream")

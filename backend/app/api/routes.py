import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.payload import ExecuteRequest
from app.services.orchestrator.graph import compile_dynamic_graph
from app.core.database import get_db
from app.models.workflow import WorkflowRun, NodeLog

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Orra Execution Engine"}

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
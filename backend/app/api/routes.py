import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.payload import ExecuteRequest
from app.services.orchestrator.graph import workflow
from app.core.database import get_db
from app.models.workflow import WorkflowRun, NodeLog

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Orra Execution Engine"}

@router.post("/execute")
async def execute_workflow(request: ExecuteRequest, db: Session = Depends(get_db)):
    # 1. Create the main run record first so we have an ID for the logs
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
    
    final_state = {}
    
    # 2. STREAM the LangGraph execution instead of invoking all at once
    for event in workflow.stream(initial_state):
        # event is a dictionary where the key is the node name, and the value is the state update
        for node_name, state_update in event.items():
            # Save a log for this specific node
            node_log = NodeLog(
                run_id=db_run.id,
                node_name=node_name,
                state_snapshot=json.dumps(state_update) # Convert dict to JSON string
            )
            db.add(node_log)
            final_state.update(state_update)
            
    # 3. Update the final status of the main run
    db_run.final_status = final_state.get("status", "completed")
    db.commit()
    
    return {
        "run_id": db_run.id,
        "workflow_id": request.workflow_id,
        "final_state": final_state,
        "message": "Execution tracked and logged!"
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
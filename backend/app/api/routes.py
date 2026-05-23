from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.payload import ExecuteRequest
from app.services.orchestrator.graph import workflow
from app.core.database import get_db
from app.models.workflow import WorkflowRun

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Orra Execution Engine"}

@router.post("/execute")
async def execute_workflow(request: ExecuteRequest, db: Session = Depends(get_db)):
    # 1. Setup the initial state
    initial_state = {
        "initial_prompt": request.initial_prompt,
        "processed_data": "",
        "status": "pending"
    }
    
    # 2. Fire off the LangGraph execution
    result = workflow.invoke(initial_state)
    
    # 3. Save the result to the Database
    db_run = WorkflowRun(
        workflow_id=request.workflow_id,
        initial_prompt=request.initial_prompt,
        final_status=result.get("status", "failed")
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    
    return {
        "run_id": db_run.id,
        "workflow_id": request.workflow_id,
        "final_state": result
    }
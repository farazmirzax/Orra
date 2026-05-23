from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime, timezone
from app.core.database import Base

class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(String, index=True)
    initial_prompt = Column(String)
    final_status = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# NEW TABLE for Node Logs
class NodeLog(Base):
    __tablename__ = "node_logs"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("workflow_runs.id")) # Links to the main run
    node_name = Column(String)
    state_snapshot = Column(String) # Storing the state as a string for now
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
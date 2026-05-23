from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from app.core.database import Base

class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(String, index=True)
    initial_prompt = Column(String)
    final_status = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
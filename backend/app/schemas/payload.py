from pydantic import BaseModel

class ExecuteRequest(BaseModel):
    workflow_id: str
    initial_prompt: str
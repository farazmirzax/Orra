from pydantic import BaseModel
from typing import List

class NodeSchema(BaseModel):
    id: str
    label: str

class EdgeSchema(BaseModel):
    source: str
    target: str

class ExecuteRequest(BaseModel):
    workflow_id: str
    initial_prompt: str
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]
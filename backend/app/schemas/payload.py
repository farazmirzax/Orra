from pydantic import BaseModel
from typing import List

class NodeSchema(BaseModel):
    id: str
    label: str
    system_prompt: str = "" # NEW: Expect system instructions
    x: float | None = None
    y: float | None = None

class EdgeSchema(BaseModel):
    source: str
    target: str

class ExecuteRequest(BaseModel):
    workflow_id: str
    initial_prompt: str
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]

class TraceStartRequest(BaseModel):
    workflow_id: str
    initial_prompt: str = ""
    nodes: List[NodeSchema] = []
    edges: List[EdgeSchema] = []

class TraceEventRequest(BaseModel):
    run_id: int
    event_type: str
    node: str | None = None
    node_label: str | None = None
    input_text: str = ""
    output_text: str = ""
    data: str = ""
    duration_ms: int | None = None
    error: str | None = None
    retry_count: int = 0

class TraceEndRequest(BaseModel):
    run_id: int
    final_status: str = "completed"

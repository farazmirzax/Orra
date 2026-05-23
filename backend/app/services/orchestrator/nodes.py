from typing import TypedDict

#Memory that gets passed between nodes
class GraphState(TypedDict):
    initial_prompt: str
    processed_data: str
    status: str

def format_prompt_node(state: GraphState):
    prompt = state.get("initial_prompt", "")
    # Simulate a node doing some work
    print(f"Node A working on: {prompt}")
    return {"processed_data": f"Formatted: [{prompt}]"}

def execute_task_node(state: GraphState):
    data = state.get("processed_data", "")
    # Simulate a final execution node
    print(f"Node B received: {data}")
    return {"status": f"Execution Success! Final data: {data}"}
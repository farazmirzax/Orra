from langgraph.graph import StateGraph, START, END
from app.services.orchestrator.nodes import GraphState, format_prompt_node, execute_task_node

# 1. Initialize the graph with our state schema
builder = StateGraph(GraphState)

# 2. Add our nodes
builder.add_node("format_prompt", format_prompt_node)
builder.add_node("execute_task", execute_task_node)

# 3. Define the edges (the flow)
builder.add_edge(START, "format_prompt")
builder.add_edge("format_prompt", "execute_task")
builder.add_edge("execute_task", END)

# 4. Compile it into an executable workflow
workflow = builder.compile()
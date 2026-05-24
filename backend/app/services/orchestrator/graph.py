from langgraph.graph import StateGraph, START, END
from app.services.orchestrator.nodes import GraphState, create_llm_node
from app.schemas.payload import NodeSchema, EdgeSchema

def compile_dynamic_graph(nodes: list[NodeSchema], edges: list[EdgeSchema]):
    builder = StateGraph(GraphState)
    
    for node in nodes:
        # Pass the system_prompt from the schema into the node
        builder.add_node(node.id, create_llm_node(node.label, node.system_prompt))
        
    target_node_ids = {edge.target for edge in edges}
    source_node_ids = {edge.source for edge in edges}
    
    for node in nodes:
        if node.id not in target_node_ids:
            builder.add_edge(START, node.id)
            
        if node.id not in source_node_ids:
            builder.add_edge(node.id, END)

    for edge in edges:
        builder.add_edge(edge.source, edge.target)
        
    return builder.compile()
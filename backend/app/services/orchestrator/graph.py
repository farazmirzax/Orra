from langgraph.graph import StateGraph, START, END
from app.services.orchestrator.nodes import GraphState, create_llm_node
from app.schemas.payload import NodeSchema, EdgeSchema

def compile_dynamic_graph(nodes: list[NodeSchema], edges: list[EdgeSchema]):
    builder = StateGraph(GraphState)
    
    # 1. Add all nodes to the graph dynamically using the real AI engine
    for node in nodes:
        builder.add_node(node.id, create_llm_node(node.label))
        
    # 2. Figure out Start and End points
    target_node_ids = {edge.target for edge in edges}
    source_node_ids = {edge.source for edge in edges}
    
    # 3. Wire the edges
    for node in nodes:
        # If a node is never a target, it must be the START node
        if node.id not in target_node_ids:
            builder.add_edge(START, node.id)
            
        # If a node is never a source, it must be the END node
        if node.id not in source_node_ids:
            builder.add_edge(node.id, END)

    # 4. Wire the connections between nodes
    for edge in edges:
        builder.add_edge(edge.source, edge.target)
        
    return builder.compile()
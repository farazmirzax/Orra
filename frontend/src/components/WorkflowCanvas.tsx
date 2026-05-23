"use client";

import { useState, useCallback, useMemo } from "react"; // Added useMemo
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  BackgroundVariant,
  Panel
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "./CustomNode"; // 1. Import our new node

const initialNodes: Node[] = [
  {
    id: "format_prompt",
    position: { x: 250, y: 100 },
    data: { label: "Format Prompt Node" },
    type: "custom", // 2. Change type from 'default' to 'custom'
  },
  {
    id: "execute_task",
    position: { x: 250, y: 250 },
    data: { label: "Execute Task Node" },
    type: "custom", // Change type here too
  },
  {
    id: "analyze_result",
    position: { x: 250, y: 400 },
    data: { label: "Analyze Result Node" },
    type: "custom", // And here
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "format_prompt", target: "execute_task", animated: true },
  { id: "e2-3", source: "execute_task", target: "analyze_result", animated: true },
];

export default function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  // 3. Register the node types using useMemo for performance
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const executeWorkflow = async () => {
    setIsRunning(true);
    setRunResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: "dynamic-ui-1",
          initial_prompt: "Hello Dynamic Orra!",
          nodes: nodes.map(n => ({ id: n.id, label: n.data.label as string })),
          edges: edges.map(e => ({ source: e.source, target: e.target }))
        }),
      });

      const data = await response.json();
      
      if (data.final_state && data.final_state.status) {
        setRunResult(data.final_state.status);
      } else {
        setRunResult("Workflow executed, but no final status returned.");
      }
    } catch (error) {
      console.error("Execution failed:", error);
      setRunResult("Error connecting to backend.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full w-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes} // 4. Pass the custom node types into React Flow
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        {/* ... (Keep your Background, Controls, and Panel exactly the same as before) ... */}
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        
        <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-md border border-gray-200 w-80">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Workflow Controls</h3>
          
          <button 
            onClick={executeWorkflow}
            disabled={isRunning}
            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
              isRunning ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isRunning ? "Running..." : "Run Workflow"}
          </button>

          {runResult && (
            <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 break-words">
              <strong>Result:</strong> <br/>
              {runResult}
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
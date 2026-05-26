"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  BackgroundVariant,
  Panel
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "./CustomNode";

// Start with a completely blank canvas!
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  
  // Start with an empty prompt
  const [promptText, setPromptText] = useState("");

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    []
  );

  // --- NEW: Add Node Function ---
  const addNode = () => {
    const newNodeId = `node_${Date.now()}`; // Unique ID based on timestamp
    const newNode: Node = {
      id: newNodeId,
      // Drop it randomly in the middle of the screen
      position: { x: 250 + Math.random() * 50, y: 100 + Math.random() * 50 }, 
      data: { label: "New Agent", systemPrompt: "" },
      type: "custom",
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const executeWorkflow = async () => {
    if (!promptText.trim()) return; // Don't run if empty
    if (nodes.length === 0) return; // Don't run if no agents exist
    
    setIsRunning(true);
    setRunResult(""); // Clear previous results so it starts fresh

    try {
      const response = await fetch("http://127.0.0.1:8000/api/execute-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: "stream-ui-1",
          initial_prompt: promptText,
          nodes: nodes.map(n => ({ 
            id: n.id, 
            label: n.data.label as string, 
            system_prompt: (n.data.systemPrompt as string) || "Be a helpful assistant." 
          })),
          edges: edges.map(e => ({ source: e.source, target: e.target }))
        }),
      });

      if (!response.body) throw new Error("No readable stream available");

      // Set up the stream reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      // Loop over the incoming data chunks
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '');
              
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              
              try {
                // Parse the JSON chunk and update the UI in real-time!
                const parsed = JSON.parse(dataStr);
                setRunResult(parsed.data); 

                setNodes((nds) =>
                  nds.map((n) => ({
                    ...n,
                    data: { ...n.data, isActive: n.id === parsed.node }
                  }))
                );
              } catch (e) {
                console.error("Error parsing stream chunk", e);
              }
            }
          }
        }
      }

      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isActive: false } })));
    } catch (error) {
      console.error("Execution failed:", error);
      setRunResult("Error connecting to backend stream.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full w-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        
        <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-md border border-gray-200 w-96">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Workflow Controls</h3>
          
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Initial Prompt</label>
            <textarea
              className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ask the agents something..."
            />
          </div>

          {/* --- NEW: Add Agent Button --- */}
          <button 
            onClick={addNode}
            className="w-full mb-2 py-2 px-4 rounded-md text-indigo-600 bg-indigo-50 border border-indigo-200 font-medium hover:bg-indigo-100 transition-colors"
          >
            + Add New Agent
          </button>

          <button 
            onClick={executeWorkflow}
            disabled={isRunning || !promptText.trim() || nodes.length === 0}
            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
              isRunning || !promptText.trim() || nodes.length === 0 ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isRunning ? "Streaming execution..." : "Run AI Workflow"}
          </button>

          {runResult && (
            <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
              <strong>Execution Output:</strong> <br/><br/>
              {runResult}
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}

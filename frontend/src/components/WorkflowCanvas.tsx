"use client";

import { useState, useCallback, useMemo } from "react";
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
import CustomNode from "./CustomNode";

// Change the labels to something fun to test the multi-agent behavior!
const initialNodes: Node[] = [
  {
    id: "node_1",
    position: { x: 250, y: 100 },
    data: { label: "Pirate Agent" },
    type: "custom",
  },
  {
    id: "node_2",
    position: { x: 250, y: 250 },
    data: { label: "Gen Z Translator Agent" },
    type: "custom",
  },
  {
    id: "node_3",
    position: { x: 250, y: 400 },
    data: { label: "Academic Professor Agent" },
    type: "custom",
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "node_1", target: "node_2", animated: true },
  { id: "e2-3", source: "node_2", target: "node_3", animated: true },
];

export default function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  
  const [promptText, setPromptText] = useState("How do black holes work?");

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
    if (!promptText.trim()) return; // Don't run if empty
    
    setIsRunning(true);
    setRunResult(""); // Clear previous results so it starts fresh

    try {
      // Changed to the new stream endpoint!
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
              } catch (e) {
                console.error("Error parsing stream chunk", e);
              }
            }
          }
        }
      }
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

          <button 
            onClick={executeWorkflow}
            disabled={isRunning || !promptText.trim()}
            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
              isRunning || !promptText.trim() ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
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
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

type NodeStatus = "idle" | "queued" | "running" | "success" | "failed";

type WorkflowNodeData = {
  label: string;
  systemPrompt?: string;
  status?: NodeStatus;
};

type StreamEvent = {
  type: "workflow_started" | "node_started" | "node_completed" | "node_failed" | "workflow_completed";
  node?: string;
  node_label?: string;
  data?: string;
  duration_ms?: number;
  timestamp?: string;
};

type TimelineEvent = {
  id: string;
  message: string;
  timestamp: string;
  status: NodeStatus | "info";
  durationMs?: number;
};

// Start with a completely blank canvas!
const initialNodes: Node<WorkflowNodeData>[] = [];
const initialEdges: Edge[] = [];

function formatTimelineTime(timestamp?: string) {
  return new Date(timestamp || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  
  // Start with an empty prompt
  const [promptText, setPromptText] = useState("");

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<WorkflowNodeData>>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
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
    const newNode: Node<WorkflowNodeData> = {
      id: newNodeId,
      // Drop it randomly in the middle of the screen
      position: { x: 250 + Math.random() * 50, y: 100 + Math.random() * 50 }, 
      data: { label: "New Agent", systemPrompt: "", status: "idle" },
      type: "custom",
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addTimelineEvent = (event: Omit<TimelineEvent, "id">) => {
    setTimelineEvents((events) => [
      ...events,
      {
        ...event,
        id: `${Date.now()}-${Math.random()}`,
      },
    ]);
  };

  const updateNodeStatus = (nodeId: string, status: NodeStatus) => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: node.id === nodeId ? status : node.data.status,
        },
      }))
    );
  };

  const executeWorkflow = async () => {
    if (!promptText.trim()) return; // Don't run if empty
    if (nodes.length === 0) return; // Don't run if no agents exist
    
    setIsRunning(true);
    setRunResult(""); // Clear previous results so it starts fresh
    setTimelineEvents([]);
    setNodes((nds) => nds.map((node) => ({ ...node, data: { ...node.data, status: "queued" } })));

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
      let buffer = "";

      // Loop over the incoming data chunks
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '');
              
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              
              try {
                // Parse the JSON chunk and update the UI in real-time!
                const parsed = JSON.parse(dataStr) as StreamEvent;
                const nodeLabel = parsed.node_label || parsed.node || "Workflow";
                const timestamp = parsed.timestamp || new Date().toISOString();

                if (parsed.type === "workflow_started") {
                  addTimelineEvent({
                    message: "Workflow started",
                    timestamp,
                    status: "info",
                  });
                }

                if (parsed.type === "node_started" && parsed.node) {
                  updateNodeStatus(parsed.node, "running");
                  addTimelineEvent({
                    message: `${nodeLabel} started`,
                    timestamp,
                    status: "running",
                  });
                }

                if (parsed.type === "node_completed" && parsed.node) {
                  setRunResult(parsed.data || "");
                  updateNodeStatus(parsed.node, "success");
                  addTimelineEvent({
                    message: `${nodeLabel} completed`,
                    timestamp,
                    status: "success",
                    durationMs: parsed.duration_ms,
                  });
                }

                if (parsed.type === "node_failed" && parsed.node) {
                  updateNodeStatus(parsed.node, "failed");
                  addTimelineEvent({
                    message: `${nodeLabel} failed`,
                    timestamp,
                    status: "failed",
                  });
                }

                if (parsed.type === "workflow_completed") {
                  addTimelineEvent({
                    message: "Workflow completed",
                    timestamp,
                    status: "success",
                  });
                }
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
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            status: node.data.status === "queued" || node.data.status === "running" ? "failed" : node.data.status,
          },
        }))
      );
      addTimelineEvent({
        message: "Workflow failed",
        timestamp: new Date().toISOString(),
        status: "failed",
      });
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

          {timelineEvents.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Execution Timeline</h4>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      event.status === "running"
                        ? "bg-green-500"
                        : event.status === "success"
                          ? "bg-emerald-500"
                          : event.status === "failed"
                            ? "bg-red-500"
                            : "bg-slate-400"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{event.message}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatTimelineTime(event.timestamp)}</span>
                      </div>
                      {typeof event.durationMs === "number" && (
                        <div className="text-[10px] text-slate-400">{event.durationMs} ms</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}

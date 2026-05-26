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
  input_text?: string;
  output_text?: string;
  error?: string;
  timestamp?: string;
};

type TimelineEvent = {
  id: string;
  message: string;
  timestamp: string;
  status: NodeStatus | "info";
  durationMs?: number;
};

type NodeExecutionDetails = {
  status: NodeStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  inputText?: string;
  outputText?: string;
  error?: string;
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeDetails, setNodeDetails] = useState<Record<string, NodeExecutionDetails>>({});
  
  // Start with an empty prompt
  const [promptText, setPromptText] = useState("");

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );
  const selectedNodeDetails = selectedNode ? nodeDetails[selectedNode.id] : undefined;

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

  const updateNodeDetails = (nodeId: string, details: Partial<NodeExecutionDetails>) => {
    setNodeDetails((currentDetails) => ({
      ...currentDetails,
      [nodeId]: {
        status: "idle",
        ...currentDetails[nodeId],
        ...details,
      },
    }));
  };

  const executeWorkflow = async () => {
    if (!promptText.trim()) return; // Don't run if empty
    if (nodes.length === 0) return; // Don't run if no agents exist
    
    setIsRunning(true);
    setRunResult(""); // Clear previous results so it starts fresh
    setTimelineEvents([]);
    setNodes((nds) => nds.map((node) => ({ ...node, data: { ...node.data, status: "queued" } })));
    setNodeDetails(
      Object.fromEntries(
        nodes.map((node) => [
          node.id,
          {
            status: "queued" as NodeStatus,
          },
        ])
      )
    );

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
                  updateNodeDetails(parsed.node, {
                    status: "running",
                    startedAt: timestamp,
                    error: undefined,
                  });
                  addTimelineEvent({
                    message: `${nodeLabel} started`,
                    timestamp,
                    status: "running",
                  });
                }

                if (parsed.type === "node_completed" && parsed.node) {
                  setRunResult(parsed.data || "");
                  updateNodeStatus(parsed.node, "success");
                  updateNodeDetails(parsed.node, {
                    status: "success",
                    completedAt: timestamp,
                    durationMs: parsed.duration_ms,
                    inputText: parsed.input_text,
                    outputText: parsed.output_text,
                  });
                  addTimelineEvent({
                    message: `${nodeLabel} completed`,
                    timestamp,
                    status: "success",
                    durationMs: parsed.duration_ms,
                  });
                }

                if (parsed.type === "node_failed" && parsed.node) {
                  updateNodeStatus(parsed.node, "failed");
                  updateNodeDetails(parsed.node, {
                    status: "failed",
                    completedAt: timestamp,
                    error: parsed.error || "Node execution failed.",
                  });
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
      setNodeDetails((currentDetails) =>
        Object.fromEntries(
          Object.entries(currentDetails).map(([nodeId, details]) => [
            nodeId,
            details.status === "queued" || details.status === "running"
              ? { ...details, status: "failed", completedAt: new Date().toISOString(), error: "Workflow failed before completion." }
              : details,
          ])
        )
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
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />

        {selectedNode && (
          <Panel position="bottom-left" className="w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-800">{selectedNode.data.label}</h3>
                <p className="text-xs text-slate-500">Node Details</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                selectedNode.data.status === "running"
                  ? "bg-green-50 text-green-700"
                  : selectedNode.data.status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : selectedNode.data.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : selectedNode.data.status === "queued"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"
              }`}>
                {selectedNode.data.status || "idle"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="mb-1 font-semibold text-slate-500">System Prompt</div>
                <div className="max-h-20 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                  {selectedNode.data.systemPrompt || "Be a helpful assistant."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-slate-200 p-2">
                  <div className="font-semibold text-slate-500">Started</div>
                  <div className="text-slate-700">{selectedNodeDetails?.startedAt ? formatTimelineTime(selectedNodeDetails.startedAt) : "Not started"}</div>
                </div>
                <div className="rounded border border-slate-200 p-2">
                  <div className="font-semibold text-slate-500">Duration</div>
                  <div className="text-slate-700">{typeof selectedNodeDetails?.durationMs === "number" ? `${selectedNodeDetails.durationMs} ms` : "Pending"}</div>
                </div>
              </div>

              <div>
                <div className="mb-1 font-semibold text-slate-500">Input Received</div>
                <div className="max-h-24 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-slate-700 whitespace-pre-wrap">
                  {selectedNodeDetails?.inputText || "No input captured yet."}
                </div>
              </div>

              <div>
                <div className="mb-1 font-semibold text-slate-500">Response Generated</div>
                <div className="max-h-28 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-slate-700 whitespace-pre-wrap">
                  {selectedNodeDetails?.outputText || "No response captured yet."}
                </div>
              </div>

              {selectedNodeDetails?.error && (
                <div>
                  <div className="mb-1 font-semibold text-red-600">Error</div>
                  <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
                    {selectedNodeDetails.error}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        )}
        
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

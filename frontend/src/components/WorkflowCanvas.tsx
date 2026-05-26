"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
  run_id?: number;
  workflow?: WorkflowSnapshot;
  node?: string;
  node_label?: string;
  data?: string;
  duration_ms?: number;
  input_text?: string;
  output_text?: string;
  error?: string;
  retry_count?: number;
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
  retryCount?: number;
};

type RunSummary = {
  run_id: number;
  workflow_id: string;
  initial_prompt: string;
  final_status: string;
  created_at: string;
};

type WorkflowSnapshot = {
  nodes: {
    id: string;
    label: string;
    system_prompt?: string;
    x?: number | null;
    y?: number | null;
  }[];
  edges: {
    source: string;
    target: string;
  }[];
};

type RunStep = {
  step_id: number;
  node: string;
  state_snapshot: StreamEvent & {
    state?: {
      processed_data?: string;
      duration_ms?: number;
      input_text?: string;
      output_text?: string;
      error?: string;
      retry_count?: number;
    };
  };
  timestamp: string;
};

type RunDetails = {
  run_id: number;
  workflow_id: string;
  final_status: string;
  execution_steps: RunStep[];
};

// Start with a completely blank canvas!
const initialNodes: Node<WorkflowNodeData>[] = [];
const initialEdges: Edge[] = [];

const workflowTemplates = [
  {
    name: "Research",
    prompt: "Research current trends in bioinformatics and summarize the most important themes.",
    nodes: [
      {
        label: "Researcher",
        systemPrompt: "Find the most relevant information and identify the key facts, patterns, and open questions.",
      },
      {
        label: "Fact Checker",
        systemPrompt: "Check the research for accuracy, uncertainty, and claims that need stronger evidence.",
      },
      {
        label: "Summarizer",
        systemPrompt: "Turn the reviewed research into a concise executive summary with clear takeaways.",
      },
    ],
  },
  {
    name: "Coding",
    prompt: "Plan and review an implementation for a small feature.",
    nodes: [
      {
        label: "Planner",
        systemPrompt: "Break the feature request into a practical implementation plan.",
      },
      {
        label: "Code Generator",
        systemPrompt: "Describe the code changes needed to implement the plan cleanly.",
      },
      {
        label: "Reviewer",
        systemPrompt: "Review the proposed implementation for bugs, edge cases, and missing tests.",
      },
    ],
  },
  {
    name: "Content",
    prompt: "Create a short product announcement for a developer tool.",
    nodes: [
      {
        label: "Writer",
        systemPrompt: "Draft clear, concise copy for a technical audience.",
      },
      {
        label: "SEO Optimizer",
        systemPrompt: "Improve discoverability while keeping the writing natural and specific.",
      },
      {
        label: "Editor",
        systemPrompt: "Polish the final copy for clarity, tone, and flow.",
      },
    ],
  },
];

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
  const [currentRunId, setCurrentRunId] = useState<number | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  
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

  const loadRecentRuns = useCallback(async () => {
    try {
      setRunsError(null);
      const response = await fetch("http://127.0.0.1:8000/api/runs");
      if (!response.ok) {
        throw new Error("Run history request failed.");
      }
      const data = await response.json();
      setRecentRuns(data.runs || []);
    } catch (error) {
      console.error("Failed to load recent runs:", error);
      setRunsError("Run history unavailable. Check that the backend is running.");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialRuns = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/runs");
        if (!response.ok) {
          throw new Error("Run history request failed.");
        }
        const data = await response.json();
        if (isMounted) {
          setRunsError(null);
          setRecentRuns(data.runs || []);
        }
      } catch (error) {
        console.error("Failed to load recent runs:", error);
        if (isMounted) {
          setRunsError("Run history unavailable. Check that the backend is running.");
        }
      }
    };

    void loadInitialRuns();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const loadTemplate = (template: typeof workflowTemplates[number]) => {
    const templateNodes: Node<WorkflowNodeData>[] = template.nodes.map((node, index) => ({
      id: `template_${Date.now()}_${index}`,
      type: "custom",
      position: { x: 260, y: 90 + index * 190 },
      data: {
        label: node.label,
        systemPrompt: node.systemPrompt,
        status: "idle",
      },
    }));

    const templateEdges: Edge[] = templateNodes.slice(0, -1).map((node, index) => ({
      id: `template_edge_${Date.now()}_${index}`,
      source: node.id,
      target: templateNodes[index + 1].id,
      animated: true,
    }));

    setNodes(templateNodes);
    setEdges(templateEdges);
    setPromptText(template.prompt);
    setRunResult(null);
    setTimelineEvents([]);
    setNodeDetails({});
    setSelectedNodeId(null);
    setCurrentRunId(null);
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
    setCurrentRunId(null);
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
            system_prompt: (n.data.systemPrompt as string) || "Be a helpful assistant.",
            x: n.position.x,
            y: n.position.y,
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
                  if (parsed.run_id) {
                    setCurrentRunId(parsed.run_id);
                  }
                  addTimelineEvent({
                    message: parsed.run_id ? `Workflow started - Run #${parsed.run_id}` : "Workflow started",
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
                    retryCount: parsed.retry_count,
                  });
                  addTimelineEvent({
                    message: `${nodeLabel} completed`,
                    timestamp,
                    status: "success",
                    durationMs: parsed.duration_ms,
                  });
                }

                if (parsed.type === "node_failed" && parsed.node) {
                  setRunResult(parsed.data || parsed.output_text || parsed.error || "Node execution failed.");
                  updateNodeStatus(parsed.node, "failed");
                  updateNodeDetails(parsed.node, {
                    status: "failed",
                    completedAt: timestamp,
                    durationMs: parsed.duration_ms,
                    inputText: parsed.input_text,
                    outputText: parsed.output_text,
                    error: parsed.error || "Node execution failed.",
                    retryCount: parsed.retry_count,
                  });
                  addTimelineEvent({
                    message: `${nodeLabel} failed`,
                    timestamp,
                    status: "failed",
                    durationMs: parsed.duration_ms,
                  });
                }

                if (parsed.type === "workflow_completed") {
                  addTimelineEvent({
                    message: "Workflow completed",
                    timestamp,
                    status: "success",
                  });
                  loadRecentRuns();
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

  const replayRun = async (runId: number) => {
    setIsReplaying(true);
    setCurrentRunId(runId);
    setTimelineEvents([]);
    setRunResult("");
    setSelectedNodeId(null);

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/runs/${runId}`);
      const runDetails = await response.json() as RunDetails;
      const steps = runDetails.execution_steps || [];
      const workflowStarted = steps.find((step) => step.state_snapshot.type === "workflow_started");
      const workflow = workflowStarted?.state_snapshot.workflow;

      if (workflow) {
        setNodes(
          workflow.nodes.map((node, index) => ({
            id: node.id,
            type: "custom",
            position: {
              x: typeof node.x === "number" ? node.x : 220 + index * 60,
              y: typeof node.y === "number" ? node.y : 120 + index * 160,
            },
            data: {
              label: node.label,
              systemPrompt: node.system_prompt || "",
              status: "idle",
            },
          }))
        );
        setEdges(
          workflow.edges.map((edge, index) => ({
            id: `replay-${runId}-${index}`,
            source: edge.source,
            target: edge.target,
            animated: true,
          }))
        );
      } else {
        const replayNodeIds = Array.from(
          new Set(
            steps
              .map((step) => step.state_snapshot.node)
              .filter((nodeId): nodeId is string => Boolean(nodeId))
          )
        );

        setNodes(
          replayNodeIds.map((nodeId, index) => {
            const nodeEvent = steps.find((step) => step.state_snapshot.node === nodeId);
            return {
              id: nodeId,
              type: "custom",
              position: { x: 260, y: 120 + index * 180 },
              data: {
                label: nodeEvent?.state_snapshot.node_label || nodeId,
                systemPrompt: "",
                status: "idle",
              },
            };
          })
        );

        setEdges(
          replayNodeIds.slice(0, -1).map((nodeId, index) => ({
            id: `replay-${runId}-fallback-${index}`,
            source: nodeId,
            target: replayNodeIds[index + 1],
            animated: true,
          }))
        );
      }

      setNodeDetails({});

      for (const step of steps) {
        const event = step.state_snapshot;
        const timestamp = event.timestamp || step.timestamp || new Date().toISOString();
        const nodeLabel = event.node_label || event.node || "Workflow";

        if (event.type === "workflow_started") {
          addTimelineEvent({
            message: `Replay started - Run #${runId}`,
            timestamp,
            status: "info",
          });
        }

        if (event.type === "node_started" && event.node) {
          updateNodeStatus(event.node, "running");
          updateNodeDetails(event.node, {
            status: "running",
            startedAt: timestamp,
          });
          addTimelineEvent({
            message: `${nodeLabel} started`,
            timestamp,
            status: "running",
          });
        }

        if (event.type === "node_completed" && event.node) {
          updateNodeStatus(event.node, "success");
          updateNodeDetails(event.node, {
            status: "success",
            completedAt: timestamp,
            durationMs: event.duration_ms,
            inputText: event.input_text || event.state?.input_text,
            outputText: event.output_text || event.state?.output_text,
            retryCount: event.retry_count || event.state?.retry_count,
          });
          setRunResult(event.data || event.state?.processed_data || "");
          addTimelineEvent({
            message: `${nodeLabel} completed`,
            timestamp,
            status: "success",
            durationMs: event.duration_ms || event.state?.duration_ms,
          });
        }

        if (event.type === "node_failed" && event.node) {
          updateNodeStatus(event.node, "failed");
          updateNodeDetails(event.node, {
            status: "failed",
            completedAt: timestamp,
            durationMs: event.duration_ms,
            inputText: event.input_text || event.state?.input_text,
            outputText: event.output_text || event.state?.output_text,
            error: event.error || event.state?.error || "Node execution failed.",
            retryCount: event.retry_count || event.state?.retry_count,
          });
          setRunResult(event.data || event.output_text || event.state?.processed_data || event.error || "Node execution failed.");
          addTimelineEvent({
            message: `${nodeLabel} failed`,
            timestamp,
            status: "failed",
            durationMs: event.duration_ms || event.state?.duration_ms,
          });
        }

        if (event.type === "workflow_completed") {
          addTimelineEvent({
            message: "Replay completed",
            timestamp,
            status: "success",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (error) {
      console.error("Replay failed:", error);
      addTimelineEvent({
        message: "Replay failed",
        timestamp: new Date().toISOString(),
        status: "failed",
      });
    } finally {
      setIsReplaying(false);
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

              {typeof selectedNodeDetails?.retryCount === "number" && (
                <div className="rounded border border-slate-200 p-2">
                  <div className="font-semibold text-slate-500">Retries</div>
                  <div className="text-slate-700">{selectedNodeDetails.retryCount}</div>
                </div>
              )}

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
          {currentRunId && (
            <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Persisted run <span className="font-semibold text-slate-800">#{currentRunId}</span>
            </div>
          )}

          <div className="mb-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Templates</div>
            <div className="grid grid-cols-3 gap-2">
              {workflowTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => loadTemplate(template)}
                  disabled={isRunning || isReplaying}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
          
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
            disabled={isRunning || isReplaying || !promptText.trim() || nodes.length === 0}
            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
              isRunning || isReplaying || !promptText.trim() || nodes.length === 0 ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isRunning ? "Streaming execution..." : isReplaying ? "Replaying run..." : "Run AI Workflow"}
          </button>

          {(runsError || recentRuns.length > 0) && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase text-slate-500">Previous Runs</h4>
                <button
                  type="button"
                  onClick={loadRecentRuns}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              {runsError && (
                <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {runsError}
                </div>
              )}
              <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                {recentRuns.map((run) => (
                  <div key={run.run_id} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-700">Run #{run.run_id}</div>
                      <div className="truncate text-[10px] text-slate-500">{run.initial_prompt}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => replayRun(run.run_id)}
                      disabled={isRunning || isReplaying}
                      className="shrink-0 rounded border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Replay
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

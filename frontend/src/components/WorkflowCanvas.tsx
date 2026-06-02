"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "./CustomNode";

const API_BASE_URL = process.env.NEXT_PUBLIC_ORRA_API_URL || "http://127.0.0.1:8000";

type NodeStatus = "idle" | "queued" | "running" | "success" | "failed";

type WorkflowNodeData = {
  label: string;
  systemPrompt?: string;
  status?: NodeStatus;
  readOnly?: boolean;
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

type TraceEvent = {
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
  state?: {
    processed_data?: string;
    duration_ms?: number;
    input_text?: string;
    output_text?: string;
    error?: string;
    retry_count?: number;
  };
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

type RunStep = {
  step_id: number;
  node: string;
  state_snapshot: TraceEvent;
  timestamp: string;
};

type RunDetails = {
  run_id: number;
  workflow_id: string;
  final_status: string;
  execution_steps: RunStep[];
};

function formatTimelineTime(timestamp?: string) {
  return new Date(timestamp || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusDot(status: NodeStatus | "info") {
  if (status === "running") return "bg-green-500";
  if (status === "success") return "bg-emerald-500";
  if (status === "failed") return "bg-red-500";
  if (status === "queued") return "bg-amber-500";
  return "bg-slate-400";
}

function statusBadge(status: NodeStatus | string) {
  if (status === "running") return "bg-green-50 text-green-700";
  if (status === "success") return "bg-emerald-50 text-emerald-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  if (status === "queued") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export default function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<RunSummary | null>(null);
  const [currentRunId, setCurrentRunId] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeDetails, setNodeDetails] = useState<Record<string, NodeExecutionDetails>>({});
  const [isReplaying, setIsReplaying] = useState(false);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );
  const selectedNodeDetails = selectedNode ? nodeDetails[selectedNode.id] : undefined;

  const loadRecentRuns = useCallback(async () => {
    try {
      setRunsError(null);
      const response = await fetch(`${API_BASE_URL}/api/runs`);
      if (!response.ok) throw new Error("Run history request failed.");
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
        const response = await fetch(`${API_BASE_URL}/api/runs`);
        if (!response.ok) throw new Error("Run history request failed.");
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
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
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
        ...currentDetails[nodeId],
        ...details,
        status: details.status || currentDetails[nodeId]?.status || "idle",
      },
    }));
  };

  const inspectRun = async (run: RunSummary) => {
    setIsReplaying(true);
    setCurrentRun(run);
    setCurrentRunId(run.run_id);
    setTimelineEvents([]);
    setRunResult("");
    setSelectedNodeId(null);
    setNodeDetails({});

    try {
      const response = await fetch(`${API_BASE_URL}/api/runs/${run.run_id}`);
      if (!response.ok) throw new Error("Run details request failed.");

      const runDetails = (await response.json()) as RunDetails;
      const steps = runDetails.execution_steps || [];
      const workflowStarted = steps.find((step) => step.state_snapshot.type === "workflow_started");
      const workflow = workflowStarted?.state_snapshot.workflow;

      if (workflow) {
        setNodes(
          workflow.nodes.map((node, index) => ({
            id: node.id,
            type: "custom",
            position: {
              x: typeof node.x === "number" ? node.x : 260,
              y: typeof node.y === "number" ? node.y : 120 + index * 180,
            },
            data: {
              label: node.label,
              systemPrompt: node.system_prompt || "",
              status: "idle",
              readOnly: true,
            },
          }))
        );
        setEdges(
          workflow.edges.map((edge, index) => ({
            id: `trace-${run.run_id}-${index}`,
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
                readOnly: true,
              },
            };
          })
        );
        setEdges(
          replayNodeIds.slice(0, -1).map((nodeId, index) => ({
            id: `trace-${run.run_id}-fallback-${index}`,
            source: nodeId,
            target: replayNodeIds[index + 1],
            animated: true,
          }))
        );
      }

      for (const step of steps) {
        const event = step.state_snapshot;
        const timestamp = event.timestamp || step.timestamp || new Date().toISOString();
        const nodeLabel = event.node_label || event.node || "Workflow";

        if (event.type === "workflow_started") {
          addTimelineEvent({
            message: `Trace loaded - Run #${run.run_id}`,
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
            durationMs: event.duration_ms || event.state?.duration_ms,
            inputText: event.input_text || event.state?.input_text,
            outputText: event.output_text || event.state?.output_text,
            retryCount: event.retry_count || event.state?.retry_count,
          });
          setRunResult(event.data || event.state?.processed_data || event.output_text || "");
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
            durationMs: event.duration_ms || event.state?.duration_ms,
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
            message: "Trace completed",
            timestamp,
            status: runDetails.final_status === "failed" ? "failed" : "success",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (error) {
      console.error("Trace inspection failed:", error);
      addTimelineEvent({
        message: "Trace inspection failed",
        timestamp: new Date().toISOString(),
        status: "failed",
      });
    } finally {
      setIsReplaying(false);
    }
  };

  const totalDuration = timelineEvents.reduce((total, event) => total + (event.durationMs || 0), 0);
  const failedNodes = Object.values(nodeDetails).filter((details) => details.status === "failed").length;

  return (
    <div className="h-full w-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        nodesDraggable={false}
        edgesFocusable={false}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />

        {nodes.length === 0 && (
          <Panel position="top-center" className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
            <div className="text-sm font-semibold text-slate-800">No trace selected</div>
            <div className="mt-1 text-xs text-slate-500">Pick a run from the inspector to visualize its agent execution graph.</div>
          </Panel>
        )}

        {selectedNode && (
          <Panel position="bottom-left" className="w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-800">{selectedNode.data.label}</h3>
                <p className="text-xs text-slate-500">Node Inspector</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(selectedNode.data.status || "idle")}`}>
                {selectedNode.data.status || "idle"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="mb-1 font-semibold text-slate-500">Instructions</div>
                <div className="max-h-20 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                  {selectedNode.data.systemPrompt || "No instructions captured for this trace."}
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
                <div className="mb-1 font-semibold text-slate-500">Input</div>
                <div className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                  {selectedNodeDetails?.inputText || "No input captured."}
                </div>
              </div>

              <div>
                <div className="mb-1 font-semibold text-slate-500">Output</div>
                <div className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                  {selectedNodeDetails?.outputText || "No output captured."}
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

        <Panel position="top-right" className="max-h-[calc(100vh-7rem)] w-[28rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-md">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Run Inspector</h3>
            <p className="mt-1 text-xs text-slate-500">SDK traces and persisted agent workflow runs appear here.</p>
          </div>

          {currentRun && (
            <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Run #{currentRun.run_id}</div>
                  <div className="truncate text-xs text-slate-500">{currentRun.workflow_id}</div>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(currentRun.final_status === "failed" ? "failed" : "success")}`}>
                  {currentRun.final_status === "failed" ? "failed" : "loaded"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-slate-200 bg-white p-2">
                  <div className="font-semibold text-slate-500">Duration</div>
                  <div className="text-slate-700">{totalDuration} ms</div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <div className="font-semibold text-slate-500">Failures</div>
                  <div className="text-slate-700">{failedNodes}</div>
                </div>
              </div>
            </div>
          )}

          {runResult && (
            <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              <div className="mb-2 font-semibold">Final Output</div>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap pr-1">
                {runResult}
              </div>
            </div>
          )}

          {timelineEvents.length > 0 && (
            <div className="mb-4 border-t border-slate-200 pt-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Execution Timeline</h4>
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDot(event.status)}`} />
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

          <div className="border-t border-slate-200 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500">Recent Runs</h4>
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

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {recentRuns.map((run) => (
                <div key={run.run_id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-700">Run #{run.run_id}</div>
                      <div className="truncate text-[10px] text-slate-500">{run.workflow_id}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => inspectRun(run)}
                      disabled={isReplaying}
                      className="shrink-0 rounded border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {isReplaying && currentRunId === run.run_id ? "Loading" : "Inspect"}
                    </button>
                  </div>
                  <div className="mt-2 line-clamp-2 text-[10px] text-slate-500">
                    {run.initial_prompt || "No initial prompt captured."}
                  </div>
                </div>
              ))}

              {!runsError && recentRuns.length === 0 && (
                <div className="rounded border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                  No traces yet. Start a run from the Orra SDK and refresh this panel.
                </div>
              )}
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

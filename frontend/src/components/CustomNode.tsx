import { useState } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";

type CustomNodeData = {
  label: string;
  systemPrompt?: string;
  status?: "idle" | "queued" | "running" | "success" | "failed";
};

type CustomNodeType = Node<CustomNodeData, "custom">;

export default function CustomNode({ id, data }: NodeProps<CustomNodeType>) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const status = data.status || "idle";

  const statusStyles = {
    idle: {
      border: "border-indigo-400",
      handle: "bg-indigo-500",
      badge: "bg-slate-100 text-slate-500",
      label: "Idle",
    },
    queued: {
      border: "border-amber-400",
      handle: "bg-amber-500",
      badge: "bg-amber-50 text-amber-700",
      label: "Queued",
    },
    running: {
      border: "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] animate-pulse",
      handle: "bg-green-500",
      badge: "bg-green-50 text-green-700",
      label: "Running",
    },
    success: {
      border: "border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.25)]",
      handle: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700",
      label: "Success",
    },
    failed: {
      border: "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.25)]",
      handle: "bg-red-500",
      badge: "bg-red-50 text-red-700",
      label: "Failed",
    },
  }[status];

  const deleteNode = () => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id));
    setEdges((edges) => edges.filter((edge) => edge.source !== id && edge.target !== id));
  };

  return (
    <div className={`relative p-3 shadow-md rounded-md bg-white border-2 transition-all duration-300 w-64 ${statusStyles.border}`}>
      <div className="nodrag nopan absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsMenuOpen((open) => !open);
          }}
          aria-label="Node options"
          title="Node options"
          className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 mt-1 w-32 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                deleteNode();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className={`w-2 h-2 ${statusStyles.handle}`} />

      <input
        className="font-bold text-slate-800 text-sm w-full pr-8 outline-none bg-transparent border-b border-transparent focus:border-indigo-200 mb-2"
        value={data.label}
        onChange={(e) => updateNodeData(id, { label: e.target.value })}
        placeholder="Agent Name..."
      />

      <div className={`mb-2 inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyles.badge}`}>
        {statusStyles.label}
      </div>

      <textarea
        className="w-full text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 outline-none focus:border-indigo-400 resize-none"
        rows={3}
        value={data.systemPrompt || ""}
        onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
        placeholder="Enter instructions for this agent..."
      />

      <Handle type="source" position={Position.Bottom} className={`w-2 h-2 ${statusStyles.handle}`} />
    </div>
  );
}

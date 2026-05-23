import { Handle, Position } from "@xyflow/react";

export default function CustomNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-white border-2 border-slate-300 w-48 text-center">
      {/* Top connection dot */}
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-500" />
      
      {/* The actual text label - fully controlled by Tailwind now! */}
      <div className="font-bold text-slate-800 text-sm">
        {data.label}
      </div>

      {/* Bottom connection dot */}
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-500" />
    </div>
  );
}
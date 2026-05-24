import { Handle, Position, useReactFlow } from "@xyflow/react";

// Add 'id' so we know which node to update
export default function CustomNode({ id, data }: { id: string; data: any }) {
  const { updateNodeData } = useReactFlow();

  return (
    <div className="p-3 shadow-md rounded-md bg-white border-2 border-indigo-400 w-64">
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-indigo-500" />
      
      {/* Editable Node Label */}
      <input 
        className="font-bold text-slate-800 text-sm w-full outline-none bg-transparent border-b border-transparent focus:border-indigo-200 mb-2"
        value={data.label}
        onChange={(e) => updateNodeData(id, { label: e.target.value })}
        placeholder="Agent Name..."
      />

      {/* Editable System Prompt */}
      <textarea
        className="w-full text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 outline-none focus:border-indigo-400 resize-none"
        rows={3}
        value={data.systemPrompt || ""}
        onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
        placeholder="Enter instructions for this agent (e.g. 'Translate to Gen Z slang')"
      />

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-indigo-500" />
    </div>
  );
}
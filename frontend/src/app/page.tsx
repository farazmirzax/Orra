import WorkflowCanvas from "@/components/WorkflowCanvas";

export default function Home() {
  return (
    <main className="h-screen w-screen flex flex-col">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
        <h1 className="text-xl font-bold text-gray-800">Orra Agent Debugger</h1>
        <span className="ml-3 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
          Trace replay dashboard
        </span>
      </header>
      
      <div className="flex-1 w-full relative">
        <WorkflowCanvas />
      </div>
    </main>
  );
}

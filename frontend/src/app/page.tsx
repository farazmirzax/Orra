import WorkflowCanvas from "@/components/WorkflowCanvas";

export default function Home() {
  return (
    <main className="h-screen w-screen flex flex-col">
      {/* A simple header so it looks like a real app */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
        <h1 className="text-xl font-bold text-gray-800">Orra Workflow Builder</h1>
      </header>
      
      {/* The Canvas container */}
      <div className="flex-1 w-full relative">
        <WorkflowCanvas />
      </div>
    </main>
  );
}
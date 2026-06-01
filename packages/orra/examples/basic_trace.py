from orra import OrraTracer


tracer = OrraTracer(
    workflow_id="package-demo",
    initial_prompt="Explain agent tracing",
    nodes=[
        {"id": "planner", "label": "Planner", "system_prompt": "Plan the answer.", "x": 250, "y": 120},
        {"id": "writer", "label": "Writer", "system_prompt": "Write the final answer.", "x": 250, "y": 320},
    ],
    edges=[
        {"source": "planner", "target": "writer"},
    ],
)

tracer.start()

prompt = "Explain agent tracing"
plan = "Explain that tracing records each agent step for debugging."

tracer.node_started("planner", "Planner", prompt)
tracer.node_completed("planner", "Planner", prompt, plan, plan, duration_ms=80)

answer = "Agent tracing records node inputs, outputs, timing, and failures so a run can be debugged later."

tracer.node_started("writer", "Writer", plan)
tracer.node_completed("writer", "Writer", plan, answer, answer, duration_ms=120)

tracer.end("completed")

print(f"Sent trace to Orra run #{tracer.run_id}")

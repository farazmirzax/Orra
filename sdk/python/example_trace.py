from orra_tracer import OrraTracer


def fake_researcher(prompt: str) -> str:
    return f"Found useful background for: {prompt}"


def fake_summarizer(research: str) -> str:
    return f"Summary: {research}"


tracer = OrraTracer(
    workflow_id="external-demo",
    initial_prompt="Explain vector databases",
    nodes=[
        {
            "id": "researcher",
            "label": "Researcher",
            "system_prompt": "Collect useful background information.",
            "x": 250,
            "y": 120,
        },
        {
            "id": "summarizer",
            "label": "Summarizer",
            "system_prompt": "Summarize the research clearly.",
            "x": 250,
            "y": 320,
        },
    ],
    edges=[
        {
            "source": "researcher",
            "target": "summarizer",
        }
    ],
)

tracer.start()

prompt = "Explain vector databases"

tracer.node_started("researcher", "Researcher", prompt)
research = fake_researcher(prompt)
tracer.node_completed("researcher", "Researcher", prompt, research, research)

tracer.node_started("summarizer", "Summarizer", research)
summary = fake_summarizer(research)
tracer.node_completed("summarizer", "Summarizer", research, summary, summary)

tracer.end("completed")

print(f"Sent trace to Orra run #{tracer.run_id}")

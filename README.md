## Orra

Orra is a visual orchestration and observability studio for AI workflows. It lets you build workflows on a canvas, run them, inspect every node input/output, replay previous runs, and trace failures.

### Debug an External Agent App

Orra can also receive traces from another Python project through the local trace API.

```python
from sdk.python.orra_tracer import OrraTracer

tracer = OrraTracer(
    workflow_id="my-agent-app",
    initial_prompt="Research vector databases",
    nodes=[
        {"id": "researcher", "label": "Researcher", "system_prompt": "Collect facts.", "x": 250, "y": 120},
        {"id": "summarizer", "label": "Summarizer", "system_prompt": "Summarize clearly.", "x": 250, "y": 320},
    ],
    edges=[{"source": "researcher", "target": "summarizer"}],
)

tracer.start()

tracer.node_started("researcher", "Researcher", "Research vector databases")
research = "Vector databases store embeddings for semantic search."
tracer.node_completed("researcher", "Researcher", "Research vector databases", research, research)

tracer.node_started("summarizer", "Summarizer", research)
summary = "Vector databases power semantic search over embedded data."
tracer.node_completed("summarizer", "Summarizer", research, summary, summary)

tracer.end("completed")
```

The run will appear in Orra's Previous Runs panel and can be replayed on the canvas.

# orra

Python tracing SDK for the Orra agent debugging dashboard.

Install locally during development:

```bash
pip install -e packages/orra
```

Use it from any Python agent app:

```python
from orra import OrraTracer

tracer = OrraTracer(
    workflow_id="research-agent",
    initial_prompt="Research vector databases",
    nodes=[
        {"id": "researcher", "label": "Researcher", "x": 250, "y": 120},
        {"id": "summarizer", "label": "Summarizer", "x": 250, "y": 320},
    ],
    edges=[
        {"source": "researcher", "target": "summarizer"},
    ],
)

tracer.start()

tracer.node_started("researcher", "Researcher", "Research vector databases")
research = "Vector databases store embeddings for semantic search."
tracer.node_completed("researcher", "Researcher", "Research vector databases", research, research)

tracer.node_started("summarizer", "Summarizer", research)
summary = "Vector databases power semantic retrieval over embedded data."
tracer.node_completed("summarizer", "Summarizer", research, summary, summary)

tracer.end("completed")
```

The trace appears in the Orra dashboard as an inspectable run.

## 👨‍💻 Built By
Developed by **Faraz Mirza** ([@farazmirzax](https://github.com/farazmirzax)). 

* [Connect on LinkedIn](https://www.linkedin.com/in/faraz-mirza-488a2627b/)
* [Check out my Portfolio](https://farazm.vercel.app)
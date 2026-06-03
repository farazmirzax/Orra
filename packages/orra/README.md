# Orra 🚀

**An open-source Python tracing SDK for visualizing multi-agent AI workflows.**

🌐 **Live Dashboard:** [orra-frontend-two.vercel.app](https://orra-frontend-two.vercel.app)

Orra provides a lightweight, real-time telemetry layer that routes agent execution steps, prompts, and outputs directly into a visual Next.js debugging dashboard. It is perfect for tracking complex, multi-agent systems (like LangGraph) with zero local bloat.

## 📦 Installation

Install the package directly from PyPI:

```bash
pip install orra
```

## 🛠️ Quick Start

Use `OrraTracer` from any Python agent app to send execution traces to your dashboard:

```python
from orra import OrraTracer

# 1. Initialize the tracer with your nodes and edges
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

# 2. Trace your agent steps in real-time
tracer.node_started("researcher", "Researcher", "Research vector databases")
research = "Vector databases store embeddings for semantic search."
tracer.node_completed("researcher", "Researcher", "Research vector databases", research, research)

tracer.node_started("summarizer", "Summarizer", research)
summary = "Vector databases power semantic retrieval over embedded data."
tracer.node_completed("summarizer", "Summarizer", research, summary, summary)

tracer.end("completed")

```

The trace instantly appears in the Orra dashboard as a fully inspectable, visual node graph!

## 👨‍💻 Built By

Developed by **Faraz Mirza** ([@farazmirzax](https://github.com/farazmirzax)).

* [Connect on LinkedIn](https://www.linkedin.com/in/faraz-mirza-488a2627b/)
* [Check out my Portfolio](https://farazm.vercel.app)

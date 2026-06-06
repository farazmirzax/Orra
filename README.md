# Orra - Open-source agent debugging and observability for local development | currently under active development

Orra is an agent trace debugging and replay dashboard for multi-agent AI systems.

Real agent applications send execution traces to Orra through the Python SDK or trace API. Orra stores those runs, visualizes the agent graph, replays execution step by step, and lets developers inspect node inputs, outputs, latency, retries, and failures.

**Try the live dashboard:** [https://orra-tracer.vercel.app](https://orra-tracer.vercel.app)

## What It Solves

Multi-agent systems are hard to debug because the final output rarely explains where things went wrong. Orra helps answer:

- Which agent received which input?
- Which agent changed the state?
- Which node failed or retried?
- What did each node output?
- How did execution move through the workflow?
- Can this run be replayed and inspected later?

Think of Orra as a local-first debugging dashboard for agentic workflows.

## Architecture

```text
User Agent App
      |
      v
Orra Python SDK
      |
      v
FastAPI Backend
      |
      v
SQLite Run Store
      |
      v
Next.js Trace Dashboard
```

## Features

- SDK-based trace ingestion for external Python agent apps
- Recent run explorer
- Read-only execution graph visualization
- Step-by-step replay
- Execution timeline
- Node inspector with input, output, duration, retries, and errors
- Persisted run history in SQLite
- Failure-state visualization
- Trace API for custom integrations

## Project Structure

```text
backend/        FastAPI API, SQLite persistence, trace endpoints
frontend/       Next.js dashboard with React Flow visualization
sdk/python/     Lightweight Python tracing client
```

## Run Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at:

```text
http://localhost:3000
```

## Install the Python SDK

Install from PyPI:

```bash
pip install orra
```

View on PyPI: [https://pypi.org/project/orra/](https://pypi.org/project/orra/)

For local development from this repo:

```bash
pip install -e packages/orra
```

`orra` is the SDK package. The backend and dashboard still run separately.

## Trace an External Python App

```python
from orra import OrraTracer

tracer = OrraTracer(
    workflow_id="research-agent",
    initial_prompt="Research vector databases",
    nodes=[
        {
            "id": "researcher",
            "label": "Researcher",
            "system_prompt": "Collect useful technical facts.",
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
        {"source": "researcher", "target": "summarizer"},
    ],
)

tracer.start()

prompt = "Research vector databases"

tracer.node_started("researcher", "Researcher", prompt)
research = "Vector databases store embeddings for semantic search and retrieval."
tracer.node_completed("researcher", "Researcher", prompt, research, research, duration_ms=420)

tracer.node_started("summarizer", "Summarizer", research)
summary = "Vector databases power semantic search by indexing embeddings."
tracer.node_completed("summarizer", "Summarizer", research, summary, summary, duration_ms=260)

tracer.end("completed")
```

After running this script, open the dashboard and click **Inspect** on the new run.

## Trace API

Start a run:

```http
POST /api/traces/start
```

Record node events:

```http
POST /api/traces/events
```

End a run:

```http
POST /api/traces/end
```

Read recent runs:

```http
GET /api/runs
```

Read a run with logs:

```http
GET /api/runs/{run_id}
```

## Development Checks

Backend syntax:

```bash
cd backend
python -m py_compile app/api/routes.py app/schemas/payload.py
```

Frontend lint:

```bash
cd frontend
.\node_modules\.bin\eslint.cmd src/components/WorkflowCanvas.tsx src/components/CustomNode.tsx src/app/page.tsx
```

SDK syntax:

```bash
python -m py_compile sdk/python/orra_tracer.py sdk/python/example_trace.py
```

## Positioning

Orra is a debugging and replay platform for agentic workflows.

The goal is to help developers understand why an AI agent system behaved the way it did.

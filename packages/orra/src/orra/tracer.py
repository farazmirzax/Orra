import json
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from typing import Any


class _NodeSpan:
    def __init__(self):
        self.output_text = ""
        self.data = ""
        self.retry_count = 0

    def output(self, value: Any, data: str | None = None, retry_count: int = 0):
        self.output_text = "" if value is None else str(value)
        self.data = data if data is not None else self.output_text
        self.retry_count = retry_count


class OrraTracer:
    def __init__(
        self,
        workflow_id: str,
        initial_prompt: str = "",
        base_url: str = "http://127.0.0.1:8000",
        nodes: list[dict[str, Any]] | None = None,
        edges: list[dict[str, str]] | None = None,
    ):
        self.workflow_id = workflow_id
        self.initial_prompt = initial_prompt
        self.base_url = base_url.rstrip("/")
        self.nodes = nodes or []
        self.edges = edges or []
        self.run_id: int | None = None

    def start(self) -> int:
        response = self._post(
            "/api/traces/start",
            {
                "workflow_id": self.workflow_id,
                "initial_prompt": self.initial_prompt,
                "nodes": self.nodes,
                "edges": self.edges,
            },
        )
        self.run_id = response["run_id"]
        return self.run_id

    def node_started(self, node: str, node_label: str | None = None, input_text: str = ""):
        self._require_run()
        self._post(
            "/api/traces/events",
            {
                "run_id": self.run_id,
                "event_type": "node_started",
                "node": node,
                "node_label": node_label or node,
                "input_text": input_text,
            },
        )

    def node_completed(
        self,
        node: str,
        node_label: str | None = None,
        input_text: str = "",
        output_text: str = "",
        data: str = "",
        duration_ms: int | None = None,
        retry_count: int = 0,
    ):
        self._require_run()
        self._post(
            "/api/traces/events",
            {
                "run_id": self.run_id,
                "event_type": "node_completed",
                "node": node,
                "node_label": node_label or node,
                "input_text": input_text,
                "output_text": output_text,
                "data": data or output_text,
                "duration_ms": duration_ms,
                "retry_count": retry_count,
            },
        )

    def node_failed(
        self,
        node: str,
        node_label: str | None = None,
        input_text: str = "",
        output_text: str = "",
        error: str = "",
        duration_ms: int | None = None,
        retry_count: int = 0,
    ):
        self._require_run()
        self._post(
            "/api/traces/events",
            {
                "run_id": self.run_id,
                "event_type": "node_failed",
                "node": node,
                "node_label": node_label or node,
                "input_text": input_text,
                "output_text": output_text,
                "data": output_text,
                "duration_ms": duration_ms,
                "error": error,
                "retry_count": retry_count,
            },
        )

    @contextmanager
    def node(self, node: str, node_label: str | None = None, input_text: str = ""):
        self._require_run()
        started_at = time.perf_counter()
        span = _NodeSpan()
        self.node_started(node=node, node_label=node_label, input_text=input_text)

        try:
            yield span
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            self.node_completed(
                node=node,
                node_label=node_label,
                input_text=input_text,
                output_text=span.output_text,
                data=span.data,
                duration_ms=duration_ms,
                retry_count=span.retry_count,
            )
        except Exception as exc:
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            self.node_failed(
                node=node,
                node_label=node_label,
                input_text=input_text,
                error=str(exc),
                duration_ms=duration_ms,
            )
            raise

    def end(self, final_status: str = "completed"):
        self._require_run()
        return self._post(
            "/api/traces/end",
            {
                "run_id": self.run_id,
                "final_status": final_status,
            },
        )

    def _require_run(self):
        if self.run_id is None:
            raise RuntimeError("Call tracer.start() before recording node events.")

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Could not reach Orra at {self.base_url}: {exc}") from exc

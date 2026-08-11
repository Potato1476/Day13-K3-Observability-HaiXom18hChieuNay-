from __future__ import annotations

import json
import re
from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from app import logging_config
from app.main import app
from app.observability_api import normalize_trace_detail, normalize_trace_summary


REPO_ROOT = Path(__file__).resolve().parents[1]


def _jaeger_trace_fixture() -> dict:
    return {
        "traceID": "0123456789abcdef0123456789abcdef",
        "processes": {
            "p1": {"serviceName": "day13-observability-lab", "tags": []}
        },
        "spans": [
            {
                "traceID": "0123456789abcdef0123456789abcdef",
                "spanID": "1111111111111111",
                "operationName": "POST /chat",
                "references": [],
                "startTime": 1_700_000_000_000_000,
                "duration": 200_000,
                "processID": "p1",
                "tags": [
                    {"key": "day13.correlation_id", "type": "string", "value": "req-test1234"},
                    {"key": "http.response.status_code", "type": "int64", "value": 500},
                ],
                "logs": [],
            },
            {
                "traceID": "0123456789abcdef0123456789abcdef",
                "spanID": "2222222222222222",
                "operationName": "rag.retrieve",
                "references": [
                    {"refType": "CHILD_OF", "traceID": "0123456789abcdef0123456789abcdef", "spanID": "1111111111111111"}
                ],
                "startTime": 1_700_000_000_020_000,
                "duration": 150_000,
                "processID": "p1",
                "tags": [
                    {"key": "otel.status_code", "type": "string", "value": "ERROR"},
                    {"key": "day13.feature", "type": "string", "value": "qa"},
                ],
                "logs": [
                    {
                        "timestamp": 1_700_000_000_030_000,
                        "fields": [
                            {"key": "event", "type": "string", "value": "exception"},
                            {"key": "exception.type", "type": "string", "value": "RuntimeError"},
                            {"key": "exception.message", "type": "string", "value": "Vector store timeout"},
                        ],
                    }
                ],
            },
        ],
    }


def test_chat_returns_trace_id_and_correlates_json_logs(monkeypatch, tmp_path: Path) -> None:
    log_path = tmp_path / "logs.jsonl"
    monkeypatch.setattr(logging_config, "LOG_PATH", log_path)

    with TestClient(app) as client:
        response = client.post(
            "/chat",
            json={
                "user_id": "otel-user",
                "session_id": "otel-session",
                "feature": "monitoring",
                "message": "Explain tracing",
            },
        )

    assert response.status_code == 200
    trace_id = response.json()["trace_id"]
    assert re.fullmatch(r"[0-9a-f]{32}", trace_id)
    assert response.headers["x-trace-id"] == trace_id
    records = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
    api_records = [record for record in records if record.get("service") == "api"]
    assert {record["trace_id"] for record in api_records} == {trace_id}
    assert all(re.fullmatch(r"[0-9a-f]{16}", record["span_id"]) for record in api_records)


def test_log_viewer_filters_by_correlation_and_trace(monkeypatch, tmp_path: Path) -> None:
    log_path = tmp_path / "logs.jsonl"
    log_path.write_text(
        "\n".join(
            [
                json.dumps({"event": "request_received", "level": "info", "correlation_id": "req-one", "trace_id": "a" * 32}),
                json.dumps({"event": "response_sent", "level": "info", "correlation_id": "req-two", "trace_id": "b" * 32}),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(logging_config, "LOG_PATH", log_path)

    with TestClient(app) as client:
        by_correlation = client.get("/observability/logs?correlation_id=req-one")
        by_trace = client.get(f"/observability/logs?trace_id={'b' * 32}")

    assert [item["event"] for item in by_correlation.json()["items"]] == ["request_received"]
    assert [item["event"] for item in by_trace.json()["items"]] == ["response_sent"]


def test_jaeger_trace_is_normalized_for_the_ui_waterfall() -> None:
    raw = _jaeger_trace_fixture()
    summary = normalize_trace_summary(raw)
    detail = normalize_trace_detail(raw)

    assert summary["operation"] == "POST /chat"
    assert summary["duration_ms"] == 200
    assert summary["span_count"] == 2
    assert summary["status"] == "error"
    assert detail["spans"][1]["parent_span_id"] == "1111111111111111"
    assert detail["spans"][1]["operation"] == "rag.retrieve"
    assert detail["spans"][1]["attributes"] == {"day13.feature": "qa"}
    assert detail["error_step"] == "rag.retrieve"
    assert detail["error"] == {
        "type": "RuntimeError",
        "message": "Vector store timeout",
        "escaped": None,
    }
    assert detail["spans"][0]["is_error_origin"] is False
    assert detail["spans"][1]["is_error_origin"] is True


def test_compose_and_grafana_provision_jaeger() -> None:
    compose = yaml.safe_load(
        (REPO_ROOT / "compose.observability.yaml").read_text(encoding="utf-8")
    )
    datasource = yaml.safe_load(
        (
            REPO_ROOT
            / "observability/grafana/provisioning/datasources/jaeger.yaml"
        ).read_text(encoding="utf-8")
    )["datasources"][0]

    assert compose["services"]["jaeger"]["image"] == "jaegertracing/jaeger:2.20.0"
    assert {"16686:16686", "4317:4317", "4318:4318"}.issubset(
        set(compose["services"]["jaeger"]["ports"])
    )
    assert datasource["type"] == "jaeger"
    assert datasource["uid"] == "jaeger-day13"
    assert datasource["url"] == "http://jaeger:16686"

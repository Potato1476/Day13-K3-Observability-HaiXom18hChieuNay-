from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import logging_config
from app.main import app


def test_chat_response_log_exposes_quality_for_dashboard(
    monkeypatch, tmp_path: Path
) -> None:
    log_path = tmp_path / "logs.jsonl"
    monkeypatch.setattr(logging_config, "LOG_PATH", log_path)

    with TestClient(app) as client:
        response = client.post(
            "/chat",
            json={
                "user_id": "student-01",
                "session_id": "session-01",
                "feature": "qa",
                "message": "Explain observability",
            },
        )

    assert response.status_code == 200
    assert response.headers["x-request-id"].startswith("req-")
    assert float(response.headers["x-response-time-ms"]) >= 0
    events = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
    response_event = next(event for event in events if event["event"] == "response_sent")
    assert response_event["quality_score"] == response.json()["quality_score"]
    assert response_event["correlation_id"] == response.json()["correlation_id"]
    assert response_event["env"] == "dev"
    assert response_event["user_id_hash"] != "student-01"
    assert response.json()["prompt_label"] == "production"
    assert response.json()["prompt_version"] == "local-v1"
    assert response_event["prompt_version"] == "local-v1"


def test_chat_can_select_local_candidate_prompt() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/chat",
            json={
                "user_id": "student-01",
                "session_id": "prompt-candidate",
                "feature": "qa",
                "message": "Explain prompt versioning",
                "prompt_label": "candidate",
            },
        )

    assert response.status_code == 200
    assert response.json()["prompt_label"] == "candidate"
    assert response.json()["prompt_version"] == "local-v2"
    assert response.json()["prompt_source"] == "local"


def test_request_id_is_propagated_and_context_pii_is_scrubbed(
    monkeypatch, tmp_path: Path
) -> None:
    log_path = tmp_path / "logs.jsonl"
    monkeypatch.setattr(logging_config, "LOG_PATH", log_path)

    with TestClient(app) as client:
        response = client.post(
            "/chat",
            headers={"x-request-id": "req-demo1234"},
            json={
                "user_id": "raw-user",
                "session_id": "student@example.com",
                "feature": "qa",
                "message": "Call 090 123 4567",
            },
        )

    assert response.headers["x-request-id"] == "req-demo1234"
    raw_logs = log_path.read_text(encoding="utf-8")
    assert "student@example.com" not in raw_logs
    assert "090 123 4567" not in raw_logs
    assert "REDACTED_EMAIL" in raw_logs
    assert "REDACTED_PHONE_VN" in raw_logs


def test_prometheus_endpoint_exposes_lab_metrics() -> None:
    with TestClient(app) as client:
        response = client.get("/prometheus")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "day13_ai_requests_total" in response.text

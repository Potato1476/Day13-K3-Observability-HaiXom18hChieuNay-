from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from prometheus_client.parser import text_string_to_metric_families

from app import logging_config
from app.main import app
from app.metrics import EXPORTED_METRICS, is_exported_metric


def sum_samples(exposition: str, name: str) -> float:
    return sum(
        sample.value
        for family in text_string_to_metric_families(exposition)
        for sample in family.samples
        if sample.name == name
    )


def test_metrics_endpoint_serves_prometheus_exposition_format(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(logging_config, "LOG_PATH", tmp_path / "logs.jsonl")

    with TestClient(app) as client:
        before = client.get("/metrics")
        client.post(
            "/chat",
            json={
                "user_id": "student-01",
                "session_id": "session-01",
                "feature": "qa",
                "message": "Explain observability",
            },
        )
        after = client.get("/metrics")

    assert after.status_code == 200
    assert after.headers["content-type"].startswith("text/plain")
    assert "# TYPE ai_requests_total counter" in after.text
    assert (
        sum_samples(after.text, "ai_requests_total")
        - sum_samples(before.text, "ai_requests_total")
        == 1
    )


def test_every_contract_metric_is_registered_in_the_app() -> None:
    """Dashboard và alert chỉ được tham chiếu series mà app thực sự export."""
    with TestClient(app) as client:
        exposition = client.get("/metrics").text

    registered = {
        family.name for family in text_string_to_metric_families(exposition)
    }
    for metric in EXPORTED_METRICS:
        # Parser bỏ hậu tố _total của counter khi đặt tên family.
        assert metric in registered or metric.removesuffix("_total") in registered


def test_is_exported_metric_accepts_histogram_sample_names() -> None:
    assert is_exported_metric("ai_request_latency_seconds_bucket")
    assert is_exported_metric("ai_quality_score_sum")
    assert is_exported_metric("ai_quality_score_count")
    assert not is_exported_metric("ai_request_latency_second_bucket")
    assert not is_exported_metric("http_requests_total")

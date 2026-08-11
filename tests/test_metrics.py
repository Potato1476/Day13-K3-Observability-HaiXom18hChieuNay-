from prometheus_client import generate_latest

from app.metrics import percentile, record_request


def test_percentile_basic() -> None:
    assert percentile([100, 200, 300, 400], 50) >= 100


def test_record_request_is_exported_for_prometheus() -> None:
    record_request(
        latency_ms=250,
        cost_usd=0.001,
        tokens_in=12,
        tokens_out=8,
        quality_score=0.8,
        feature="qa",
    )

    exposition = generate_latest().decode("utf-8")
    assert 'day13_ai_requests_total{feature="qa",status="success"}' in exposition
    assert 'day13_ai_tokens_total{direction="input",feature="qa"}' in exposition
    assert "day13_ai_request_latency_seconds_bucket" in exposition


def test_unknown_feature_is_collapsed_to_other_label() -> None:
    record_request(100, 0.0, 1, 1, 0.5, feature="student@example.com")

    exposition = generate_latest().decode("utf-8")
    assert 'day13_ai_requests_total{feature="other",status="success"}' in exposition
    assert "student@example.com" not in exposition


def test_known_feature_series_exist_before_their_first_request() -> None:
    exposition = generate_latest().decode("utf-8")

    assert 'day13_ai_requests_total{feature="refund",status="success"} 0.0' in exposition
    assert 'day13_ai_quality_score_count{feature="monitoring"} 0.0' in exposition

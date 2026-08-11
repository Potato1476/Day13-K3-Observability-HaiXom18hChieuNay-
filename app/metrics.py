from __future__ import annotations

from collections import Counter
from statistics import mean

from prometheus_client import Counter as PrometheusCounter
from prometheus_client import Histogram, Summary

REQUEST_LATENCIES: list[int] = []
REQUEST_COSTS: list[float] = []
REQUEST_TOKENS_IN: list[int] = []
REQUEST_TOKENS_OUT: list[int] = []
ERRORS: Counter[str] = Counter()
TRAFFIC: int = 0
QUALITY_SCORES: list[float] = []

PROMETHEUS_REQUESTS = PrometheusCounter(
    "day13_ai_requests_total",
    "Total AI chat requests by feature and outcome.",
    ("feature", "status"),
)
PROMETHEUS_LATENCY = Histogram(
    "day13_ai_request_latency_seconds",
    "AI chat request latency in seconds.",
    ("feature",),
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10),
)
PROMETHEUS_COST = PrometheusCounter(
    "day13_ai_cost_usd_total",
    "Estimated AI model cost in US dollars.",
    ("feature",),
)
PROMETHEUS_TOKENS = PrometheusCounter(
    "day13_ai_tokens_total",
    "Total AI tokens by direction.",
    ("feature", "direction"),
)
PROMETHEUS_QUALITY = Summary(
    "day13_ai_quality_score",
    "Observed response quality proxy score from zero to one.",
    ("feature",),
)
PROMETHEUS_ERRORS = PrometheusCounter(
    "day13_ai_errors_total",
    "Total failed AI chat requests by error type.",
    ("feature", "error_type"),
)

KNOWN_FEATURES = frozenset({"qa", "summary", "refund", "monitoring"})
METRIC_FEATURES = KNOWN_FEATURES | {"other"}
KNOWN_ERROR_TYPES = frozenset(
    {"ConnectionError", "RuntimeError", "TimeoutError", "ValueError", "other"}
)


def _metric_feature(feature: str) -> str:
    """Keep metric label cardinality bounded and prevent PII in label values."""
    normalized = feature.strip().lower()
    return normalized if normalized in KNOWN_FEATURES else "other"


def _metric_error_type(error_type: str) -> str:
    return error_type if error_type in KNOWN_ERROR_TYPES else "other"


def _initialize_metric_series() -> None:
    """Expose zero-valued children before the first burst so rate() sees a baseline."""
    for feature in METRIC_FEATURES:
        PROMETHEUS_REQUESTS.labels(feature=feature, status="success")
        PROMETHEUS_REQUESTS.labels(feature=feature, status="error")
        PROMETHEUS_LATENCY.labels(feature=feature)
        PROMETHEUS_COST.labels(feature=feature)
        PROMETHEUS_TOKENS.labels(feature=feature, direction="input")
        PROMETHEUS_TOKENS.labels(feature=feature, direction="output")
        PROMETHEUS_QUALITY.labels(feature=feature)
        for error_type in KNOWN_ERROR_TYPES:
            PROMETHEUS_ERRORS.labels(feature=feature, error_type=error_type)


def record_request(
    latency_ms: int,
    cost_usd: float,
    tokens_in: int,
    tokens_out: int,
    quality_score: float,
    feature: str = "other",
) -> None:
    global TRAFFIC
    TRAFFIC += 1
    REQUEST_LATENCIES.append(latency_ms)
    REQUEST_COSTS.append(cost_usd)
    REQUEST_TOKENS_IN.append(tokens_in)
    REQUEST_TOKENS_OUT.append(tokens_out)
    QUALITY_SCORES.append(quality_score)

    metric_feature = _metric_feature(feature)
    PROMETHEUS_REQUESTS.labels(feature=metric_feature, status="success").inc()
    PROMETHEUS_LATENCY.labels(feature=metric_feature).observe(latency_ms / 1000)
    PROMETHEUS_COST.labels(feature=metric_feature).inc(cost_usd)
    PROMETHEUS_TOKENS.labels(feature=metric_feature, direction="input").inc(tokens_in)
    PROMETHEUS_TOKENS.labels(feature=metric_feature, direction="output").inc(tokens_out)
    PROMETHEUS_QUALITY.labels(feature=metric_feature).observe(quality_score)


def record_error(error_type: str, feature: str = "other") -> None:
    global TRAFFIC
    TRAFFIC += 1
    ERRORS[error_type] += 1
    metric_feature = _metric_feature(feature)
    metric_error_type = _metric_error_type(error_type)
    PROMETHEUS_REQUESTS.labels(feature=metric_feature, status="error").inc()
    PROMETHEUS_ERRORS.labels(
        feature=metric_feature, error_type=metric_error_type
    ).inc()


def percentile(values: list[int], p: int) -> float:
    if not values:
        return 0.0
    items = sorted(values)
    idx = max(0, min(len(items) - 1, round((p / 100) * len(items) + 0.5) - 1))
    return float(items[idx])


def snapshot() -> dict:
    return {
        "traffic": TRAFFIC,
        "latency_p50": percentile(REQUEST_LATENCIES, 50),
        "latency_p95": percentile(REQUEST_LATENCIES, 95),
        "latency_p99": percentile(REQUEST_LATENCIES, 99),
        "avg_cost_usd": round(mean(REQUEST_COSTS), 4) if REQUEST_COSTS else 0.0,
        "total_cost_usd": round(sum(REQUEST_COSTS), 4),
        "tokens_in_total": sum(REQUEST_TOKENS_IN),
        "tokens_out_total": sum(REQUEST_TOKENS_OUT),
        "error_breakdown": dict(ERRORS),
        "quality_avg": round(mean(QUALITY_SCORES), 4) if QUALITY_SCORES else 0.0,
    }


_initialize_metric_series()

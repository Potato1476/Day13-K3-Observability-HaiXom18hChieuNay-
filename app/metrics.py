from __future__ import annotations

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

# Prometheus dùng giây cho latency và hậu tố _total cho counter.
# Giữ nguyên tên metric ở đây: config/dashboard.yaml và config/alert_rules.yaml
# đều tham chiếu đúng những tên này, và validator sẽ đối chiếu lại.

LATENCY_BUCKETS_SECONDS = (
    0.05,
    0.1,
    0.25,
    0.5,
    0.75,
    1.0,
    1.5,
    2.0,
    2.5,
    3.0,
    5.0,
    10.0,
)
QUALITY_BUCKETS = (0.2, 0.4, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0)

REQUESTS = Counter(
    "ai_requests_total",
    "Số request đã xử lý, tách theo trạng thái success/error.",
    ["feature", "model", "status"],
)
LATENCY = Histogram(
    "ai_request_latency_seconds",
    "Latency end-to-end của một request, tính bằng giây.",
    ["feature", "model"],
    buckets=LATENCY_BUCKETS_SECONDS,
)
ERRORS = Counter(
    "ai_errors_total",
    "Số lỗi tách theo loại exception.",
    ["feature", "error_type"],
)
TOKENS = Counter(
    "ai_tokens_total",
    "Tổng token, tách theo direction=input|output.",
    ["feature", "model", "direction"],
)
COST = Counter(
    "ai_cost_usd_total",
    "Tổng chi phí ước tính, tính bằng USD.",
    ["feature", "model"],
)
QUALITY = Histogram(
    "ai_quality_score",
    "Quality proxy trong khoảng 0..1.",
    ["feature"],
    buckets=QUALITY_BUCKETS,
)

# Tên series được phép dùng trong dashboard và alert. Histogram còn sinh thêm
# các sample _bucket, _sum và _count từ cùng một tên gốc.
EXPORTED_METRICS = frozenset(
    {
        "ai_requests_total",
        "ai_request_latency_seconds",
        "ai_errors_total",
        "ai_tokens_total",
        "ai_cost_usd_total",
        "ai_quality_score",
    }
)
_HISTOGRAM_SUFFIXES = ("_bucket", "_sum", "_count")


def is_exported_metric(name: str) -> bool:
    if name in EXPORTED_METRICS:
        return True
    return any(
        name.endswith(suffix) and name[: -len(suffix)] in EXPORTED_METRICS
        for suffix in _HISTOGRAM_SUFFIXES
    )


def record_request(
    *,
    feature: str,
    model: str,
    latency_ms: int,
    cost_usd: float,
    tokens_in: int,
    tokens_out: int,
    quality_score: float,
) -> None:
    # Ví dụ mẫu: traffic panel chỉ cần counter này.
    REQUESTS.labels(feature=feature, model=model, status="success").inc()

    # Ghi latency vào histogram. Prometheus dùng GIÂY, không phải mili giây.
    LATENCY.labels(feature=feature, model=model).observe(latency_ms / 1000)

    # Cộng token vào counter theo hai direction riêng biệt.
    TOKENS.labels(feature=feature, model=model, direction="input").inc(tokens_in)
    TOKENS.labels(feature=feature, model=model, direction="output").inc(tokens_out)

    # Cộng chi phí của request vào counter cost.
    COST.labels(feature=feature, model=model).inc(cost_usd)

    # Ghi quality proxy vào histogram để panel quality tính được mean.
    QUALITY.labels(feature=feature).observe(quality_score)


def record_error(error_type: str, feature: str = "unknown", model: str = "unknown") -> None:
    # Một request lỗi vẫn là một request. Nếu không đếm nó ở đây thì
    # mẫu số của error rate sẽ sai và panel errors luôn báo 0%.
    REQUESTS.labels(feature=feature, model=model, status="error").inc()

    # Đếm lỗi theo error_type để vẽ được breakdown.
    ERRORS.labels(feature=feature, error_type=error_type).inc()


def render_latest() -> tuple[bytes, str]:
    """Trả về payload dạng Prometheus exposition format cho endpoint /metrics."""
    return generate_latest(), CONTENT_TYPE_LATEST

from __future__ import annotations

import os
import sys
from contextlib import contextmanager
from typing import Any, Iterator

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Span, Status, StatusCode

SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "day13-observability-lab")
OTLP_ENDPOINT = os.getenv(
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    "http://127.0.0.1:4318/v1/traces",
)

_configured = False
_provider: TracerProvider | None = None


def otel_tracing_enabled() -> bool:
    return os.getenv("OTEL_TRACING_ENABLED", "true").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def configure_otel_tracing() -> None:
    """Configure one process-wide OTLP trace exporter for the local Jaeger backend."""
    global _configured, _provider
    if _configured or not otel_tracing_enabled():
        return

    provider = TracerProvider(
        resource=Resource.create(
            {
                "service.name": SERVICE_NAME,
                "service.version": "day13-lab",
                "deployment.environment": os.getenv("APP_ENV", "dev"),
            }
        )
    )
    if "pytest" not in sys.modules:
        exporter = OTLPSpanExporter(endpoint=OTLP_ENDPOINT, timeout=3)
        provider.add_span_processor(
            BatchSpanProcessor(
                exporter,
                schedule_delay_millis=500,
                max_export_batch_size=128,
            )
        )
    trace.set_tracer_provider(provider)
    _provider = provider
    _configured = True


def get_tracer():
    return trace.get_tracer("day13.ai-observability")


def current_trace_context() -> dict[str, str]:
    context = trace.get_current_span().get_span_context()
    if not context.is_valid:
        return {}
    return {
        "trace_id": format(context.trace_id, "032x"),
        "span_id": format(context.span_id, "016x"),
    }


def set_span_attributes(span: Span, attributes: dict[str, Any]) -> None:
    for key, value in attributes.items():
        if value is not None and isinstance(value, (bool, str, int, float)):
            span.set_attribute(key, value)


@contextmanager
def traced_span(name: str, **attributes: Any) -> Iterator[Span]:
    with get_tracer().start_as_current_span(
        name,
        record_exception=False,
        set_status_on_exception=False,
    ) as span:
        set_span_attributes(span, attributes)
        try:
            yield span
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, type(exc).__name__))
            raise


def force_flush(timeout_millis: int = 5000) -> bool:
    if _provider is None:
        return True
    return _provider.force_flush(timeout_millis=timeout_millis)

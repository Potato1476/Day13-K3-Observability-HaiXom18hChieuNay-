from __future__ import annotations

import time
import uuid

from fastapi import Request
from opentelemetry import propagate
from opentelemetry.trace import SpanKind, Status, StatusCode
from starlette.middleware.base import BaseHTTPMiddleware
from structlog.contextvars import bind_contextvars, clear_contextvars

from .otel_tracing import current_trace_context, get_tracer, set_span_attributes


TRACED_PATHS = frozenset({"/chat"})


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        clear_contextvars()

        incoming_request_id = request.headers.get("x-request-id", "").strip()
        correlation_id = incoming_request_id or f"req-{uuid.uuid4().hex[:8]}"

        bind_contextvars(correlation_id=correlation_id)
        request.state.correlation_id = correlation_id

        start = time.perf_counter()
        if request.url.path not in TRACED_PATHS:
            response = await call_next(request)
        else:
            parent_context = propagate.extract(dict(request.headers))
            span_name = f"{request.method} {request.url.path}"
            with get_tracer().start_as_current_span(
                span_name,
                context=parent_context,
                kind=SpanKind.SERVER,
                record_exception=False,
                set_status_on_exception=False,
            ) as span:
                set_span_attributes(
                    span,
                    {
                        "http.request.method": request.method,
                        "url.path": request.url.path,
                        "server.address": request.url.hostname or "localhost",
                        "day13.correlation_id": correlation_id,
                    },
                )
                request.state.trace_id = current_trace_context().get("trace_id")
                try:
                    response = await call_next(request)
                    span.set_attribute("http.response.status_code", response.status_code)
                    if response.status_code >= 500:
                        span.set_status(Status(StatusCode.ERROR))
                except Exception as exc:
                    span.record_exception(exc)
                    span.set_status(Status(StatusCode.ERROR, type(exc).__name__))
                    raise

        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["x-request-id"] = correlation_id
        response.headers["x-response-time-ms"] = f"{elapsed_ms:.2f}"
        trace_id = getattr(request.state, "trace_id", None)
        if trace_id:
            response.headers["x-trace-id"] = trace_id

        return response

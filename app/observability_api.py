from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from . import logging_config
from .otel_tracing import SERVICE_NAME, force_flush
from .pii import summarize_text

router = APIRouter(prefix="/observability", tags=["observability"])

JAEGER_QUERY_URL = os.getenv("JAEGER_QUERY_URL", "http://127.0.0.1:16686").rstrip("/")
TRACE_ID_PATTERN = re.compile(r"^[0-9a-fA-F]{16,32}$")


def _tag_map(tags: list[dict[str, Any]] | None) -> dict[str, Any]:
    return {
        str(tag.get("key")): tag.get("value")
        for tag in tags or []
        if tag.get("key") is not None
    }


def _span_service(trace: dict[str, Any], span: dict[str, Any]) -> str:
    process = trace.get("processes", {}).get(span.get("processID"), {})
    return str(process.get("serviceName") or SERVICE_NAME)


def _span_failed(span: dict[str, Any]) -> bool:
    tags = _tag_map(span.get("tags"))
    status_code = tags.get("otel.status_code")
    http_status = tags.get("http.response.status_code") or tags.get("http.status_code")
    return bool(
        tags.get("error") is True
        or str(status_code).upper() == "ERROR"
        or (isinstance(http_status, (int, float)) and http_status >= 500)
    )


def _span_exception(span: dict[str, Any]) -> dict[str, Any] | None:
    """Return a small, PII-scrubbed exception summary from an OTel span event."""
    tags = _tag_map(span.get("tags"))
    for event in span.get("logs") or []:
        fields = _tag_map(event.get("fields"))
        if fields.get("event") != "exception" and not fields.get("exception.type"):
            continue
        error_type = fields.get("exception.type") or tags.get("error.type")
        message = fields.get("exception.message")
        escaped = fields.get("exception.escaped")
        if isinstance(escaped, str) and escaped.lower() in {"true", "false"}:
            escaped = escaped.lower() == "true"
        return {
            "type": str(error_type) if error_type else "Exception",
            "message": summarize_text(str(message), max_len=240) if message else None,
            "escaped": escaped,
        }

    error_type = tags.get("error.type")
    status_description = tags.get("otel.status_description")
    if error_type or status_description:
        return {
            "type": str(error_type or "Error"),
            "message": (
                summarize_text(str(status_description), max_len=240)
                if status_description
                else None
            ),
            "escaped": None,
        }
    return None


def normalize_trace_summary(trace: dict[str, Any]) -> dict[str, Any]:
    spans = trace.get("spans") or []
    if not spans:
        return {
            "trace_id": trace.get("traceID", ""),
            "operation": "unknown",
            "service": SERVICE_NAME,
            "started_at": None,
            "duration_ms": 0.0,
            "span_count": 0,
            "status": "ok",
        }

    ordered = sorted(spans, key=lambda span: span.get("startTime", 0))
    roots = [span for span in ordered if not span.get("references")]
    root = roots[0] if roots else ordered[0]
    started_us = min(span.get("startTime", 0) for span in ordered)
    ended_us = max(
        span.get("startTime", 0) + span.get("duration", 0) for span in ordered
    )
    started_at = datetime.fromtimestamp(started_us / 1_000_000, tz=timezone.utc)
    return {
        "trace_id": trace.get("traceID", ""),
        "operation": root.get("operationName", "unknown"),
        "service": _span_service(trace, root),
        "started_at": started_at.isoformat(),
        "duration_ms": round(max(0, ended_us - started_us) / 1000, 2),
        "span_count": len(ordered),
        "status": "error" if any(_span_failed(span) for span in ordered) else "ok",
    }


def normalize_trace_detail(trace: dict[str, Any]) -> dict[str, Any]:
    summary = normalize_trace_summary(trace)
    raw_spans = sorted(trace.get("spans") or [], key=lambda span: span.get("startTime", 0))
    if not raw_spans:
        return {**summary, "spans": []}

    trace_start_us = min(span.get("startTime", 0) for span in raw_spans)
    failed_span_ids = {
        str(span.get("spanID")) for span in raw_spans if _span_failed(span)
    }
    failed_parent_ids = {
        str(reference.get("spanID"))
        for span in raw_spans
        if str(span.get("spanID")) in failed_span_ids
        for reference in span.get("references") or []
        if reference.get("refType") == "CHILD_OF"
        and str(reference.get("spanID")) in failed_span_ids
    }
    error_origin_ids = failed_span_ids - failed_parent_ids

    spans = []
    for span in raw_spans:
        references = span.get("references") or []
        parent = next(
            (
                reference.get("spanID")
                for reference in references
                if reference.get("refType") == "CHILD_OF"
            ),
            None,
        )
        tags = _tag_map(span.get("tags"))
        safe_attributes = {
            key: value
            for key, value in tags.items()
            if key
            in {
                "day13.correlation_id",
                "day13.feature",
                "day13.latency_ms",
                "day13.cost_usd",
                "day13.quality_score",
                "gen_ai.request.model",
                "gen_ai.prompt.name",
                "gen_ai.prompt.label",
                "gen_ai.prompt.version",
                "gen_ai.prompt.source",
                "gen_ai.usage.input_tokens",
                "gen_ai.usage.output_tokens",
                "http.request.method",
                "http.response.status_code",
                "url.path",
                "error.type",
            }
        }
        spans.append(
            {
                "span_id": span.get("spanID", ""),
                "parent_span_id": parent,
                "operation": span.get("operationName", "unknown"),
                "service": _span_service(trace, span),
                "start_offset_ms": round(
                    (span.get("startTime", 0) - trace_start_us) / 1000, 2
                ),
                "duration_ms": round(span.get("duration", 0) / 1000, 2),
                "status": "error" if _span_failed(span) else "ok",
                "is_error_origin": str(span.get("spanID")) in error_origin_ids,
                "error": _span_exception(span),
                "attributes": safe_attributes,
                "event_count": len(span.get("logs") or []),
            }
        )
    error_origins = [span for span in spans if span["is_error_origin"]]
    primary_error = error_origins[0] if error_origins else None
    return {
        **summary,
        "error_step": primary_error["operation"] if primary_error else None,
        "error": primary_error["error"] if primary_error else None,
        "spans": spans,
    }


@router.get("/logs")
async def read_logs(
    limit: int = Query(default=200, ge=1, le=500),
    correlation_id: str | None = Query(default=None, max_length=128),
    trace_id: str | None = Query(default=None, max_length=64),
    event: str | None = Query(default=None, max_length=80),
    level: str | None = Query(default=None, max_length=20),
    feature: str | None = Query(default=None, max_length=40),
) -> dict[str, Any]:
    path = logging_config.LOG_PATH
    if not path.exists():
        return {"items": [], "total": 0, "path": str(path)}

    items: list[dict[str, Any]] = []
    for line in reversed(path.read_text(encoding="utf-8").splitlines()):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if correlation_id and record.get("correlation_id") != correlation_id:
            continue
        if trace_id and record.get("trace_id") != trace_id:
            continue
        if event and record.get("event") != event:
            continue
        if level and record.get("level") != level:
            continue
        if feature and record.get("feature") != feature:
            continue
        items.append(record)
        if len(items) >= limit:
            break
    return {"items": items, "total": len(items), "path": str(path)}


async def _jaeger_get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{JAEGER_QUERY_URL}{path}", params=params)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Jaeger chưa sẵn sàng: {type(exc).__name__}",
        ) from exc


@router.get("/traces")
async def read_traces(
    limit: int = Query(default=20, ge=1, le=100),
    lookback: str = Query(default="1h", pattern=r"^(15m|30m|1h|2h|6h|12h|24h)$"),
) -> dict[str, Any]:
    force_flush(3000)
    payload = await _jaeger_get(
        "/api/traces",
        params={"service": SERVICE_NAME, "limit": limit, "lookback": lookback},
    )
    items = [normalize_trace_summary(trace) for trace in payload.get("data", [])]
    items = [item for item in items if item["operation"] == "POST /chat"]
    items.sort(key=lambda item: item.get("started_at") or "", reverse=True)
    return {"items": items, "total": len(items), "backend": "jaeger"}


@router.get("/traces/{trace_id}")
async def read_trace(trace_id: str) -> dict[str, Any]:
    if not TRACE_ID_PATTERN.fullmatch(trace_id):
        raise HTTPException(status_code=400, detail="Trace ID không hợp lệ")
    force_flush(3000)
    payload = await _jaeger_get(f"/api/traces/{trace_id.lower()}")
    traces = payload.get("data") or []
    if not traces:
        raise HTTPException(status_code=404, detail="Không tìm thấy trace")
    return normalize_trace_detail(traces[0])

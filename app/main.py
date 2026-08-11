from __future__ import annotations

import os

import asyncio
import random

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .agent import LabAgent
from .incidents import disable, enable, status
from .logging_config import configure_logging, get_logger
from .metrics import record_error, render_latest, REQUESTS, LATENCY, ERRORS, TOKENS, COST, QUALITY
from .middleware import CorrelationIdMiddleware
from .pii import hash_user_id, summarize_text
from .prompt_management import resolve_prompt
from .schemas import ChatRequest, ChatResponse
from .tracing import get_langfuse_client, tracing_enabled

configure_logging()
log = get_logger()
app = FastAPI(title="Day 13 Observability Lab")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CorrelationIdMiddleware)
agent = LabAgent()


class StressTestRequest(BaseModel):
    concurrency: int = Field(default=5, ge=1, le=50)
    requests: int = Field(default=20, ge=1, le=200)


class PromptLabelRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=64, examples=["production", "baseline", "candidate"])


# Label dùng trong docs/PROMPT_VERSIONING.md; UI hiển thị đúng ba nút này.
PROMPT_LABELS = ("baseline", "candidate", "production")


def _resolve_current_prompt() -> dict:
    """Giải prompt hiện tại đúng cách agent làm, để UI thấy cùng một kết quả."""
    prompt = resolve_prompt(
        get_langfuse_client(),
        feature="qa",
        docs=["Prompt version probe"],
        message="Which prompt version is active?",
        enabled=tracing_enabled(),
    )
    return {
        "ok": True,
        "tracing_enabled": tracing_enabled(),
        "prompt_name": prompt.name,
        "prompt_label": prompt.label,
        "prompt_version": prompt.version,
        "prompt_source": prompt.source,
        "fetch_error": prompt.fetch_error,
        "available_labels": list(PROMPT_LABELS),
        "host": os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
    }


@app.on_event("startup")
async def startup() -> None:
    log.info(
        "app_started",
        service=os.getenv("APP_NAME", "day13-observability-lab"),
        env=os.getenv("APP_ENV", "dev"),
        payload={"tracing_enabled": tracing_enabled()},
    )


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "tracing_enabled": tracing_enabled(), "incidents": status()}


@app.get("/incidents")
async def get_incidents() -> dict:
    return {"ok": True, "incidents": status()}


@app.get("/logs")
async def get_logs(limit: int = 50) -> dict:
    logs_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "logs.jsonl")
    lines = []
    if os.path.exists(logs_file):
        with open(logs_file, "r", encoding="utf-8") as f:
            all_lines = [line.strip() for line in f if line.strip()]
            for line in all_lines[-limit:]:
                try:
                    import json
                    lines.append(json.loads(line))
                except Exception:
                    pass
    return {"ok": True, "count": len(lines), "logs": list(reversed(lines))}


@app.get("/traces")
async def get_traces() -> dict:
    return {
        "ok": True,
        "tracing_enabled": tracing_enabled(),
        "prompt_name": os.getenv("LANGFUSE_PROMPT_NAME", "day13-chat"),
        "prompt_label": os.getenv("LANGFUSE_PROMPT_LABEL", "production"),
        "host": os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
    }


@app.get("/prompt")
async def get_prompt() -> dict:
    """Prompt name/label/version/source đang có hiệu lực, đọc trực tiếp từ Langfuse."""
    return _resolve_current_prompt()


@app.post("/prompt/label")
async def set_prompt_label(body: PromptLabelRequest) -> JSONResponse:
    """Đổi label đang dùng để demo switch và rollback mà không phải restart API.

    Chỉ đổi trong tiến trình đang chạy; `.env` không bị ghi đè, nên restart sẽ
    quay lại LANGFUSE_PROMPT_LABEL ban đầu.
    """
    previous = os.getenv("LANGFUSE_PROMPT_LABEL", "production")
    os.environ["LANGFUSE_PROMPT_LABEL"] = body.label
    resolved = _resolve_current_prompt()
    log.warning(
        "prompt_label_changed",
        service="control",
        payload={
            "from_label": previous,
            "to_label": body.label,
            "prompt_version": resolved["prompt_version"],
            "prompt_source": resolved["prompt_source"],
        },
    )
    return JSONResponse({**resolved, "previous_label": previous})


@app.get("/incidents")
async def get_incidents() -> dict:
    return {"ok": True, "incidents": status()}


@app.get("/telemetry")
async def get_telemetry() -> dict:
    try:
        req_samples = REQUESTS.collect()[0].samples if REQUESTS.collect() else []
        req_success = sum(m.value for m in req_samples if m.name == "ai_requests_total" and m.labels.get("status") == "success")
        req_error = sum(m.value for m in req_samples if m.name == "ai_requests_total" and m.labels.get("status") == "error")

        lat_samples = LATENCY.collect()[0].samples if LATENCY.collect() else []
        lat_sum = sum(m.value for m in lat_samples if m.name == "ai_request_latency_seconds_sum")
        lat_count = sum(m.value for m in lat_samples if m.name == "ai_request_latency_seconds_count")

        tok_samples = TOKENS.collect()[0].samples if TOKENS.collect() else []
        tokens_in = sum(m.value for m in tok_samples if m.name == "ai_tokens_total" and m.labels.get("direction") == "input")
        tokens_out = sum(m.value for m in tok_samples if m.name == "ai_tokens_total" and m.labels.get("direction") == "output")

        cost_samples = COST.collect()[0].samples if COST.collect() else []
        cost_usd = sum(m.value for m in cost_samples if m.name == "ai_cost_usd_total")

        qual_samples = QUALITY.collect()[0].samples if QUALITY.collect() else []
        qual_sum = sum(m.value for m in qual_samples if m.name == "ai_quality_score_sum")
        qual_count = sum(m.value for m in qual_samples if m.name == "ai_quality_score_count")

        avg_lat_ms = (lat_sum / lat_count * 1000) if lat_count > 0 else 0.0
        avg_qual = (qual_sum / qual_count) if qual_count > 0 else 0.0

        return {
            "ok": True,
            "requests": int(req_success + req_error),
            "errors": int(req_error),
            "avg_latency_ms": round(avg_lat_ms, 2),
            "tokens_in": int(tokens_in),
            "tokens_out": int(tokens_out),
            "cost_usd": round(cost_usd, 6),
            "quality_score": round(avg_qual, 2)
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/metrics")
async def metrics() -> Response:
    """Prometheus scrape endpoint — trả về text exposition format, không phải JSON."""
    payload, content_type = render_latest()
    return Response(content=payload, media_type=content_type)


@app.post("/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    # TODO: Enrich logs with request context (user_id_hash, session_id, feature, model, env)
    # bind_contextvars(...)
    
    log.info(
        "request_received",
        service="api",
        payload={"message_preview": summarize_text(body.message)},
    )
    try:
        result = agent.run(
            user_id=body.user_id,
            feature=body.feature,
            session_id=body.session_id,
            message=body.message,
        )
        log.info(
            "response_sent",
            service="api",
            latency_ms=result.latency_ms,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cost_usd=result.cost_usd,
            quality_score=result.quality_score,
            payload={"answer_preview": summarize_text(result.answer)},
        )
        return ChatResponse(
            answer=result.answer,
            correlation_id=request.state.correlation_id,
            latency_ms=result.latency_ms,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cost_usd=result.cost_usd,
            quality_score=result.quality_score,
        )
    except Exception as exc:  # pragma: no cover
        error_type = type(exc).__name__
        record_error(error_type, feature=body.feature, model=agent.model)
        log.error(
            "request_failed",
            service="api",
            error_type=error_type,
            payload={"detail": str(exc), "message_preview": summarize_text(body.message)},
        )
        raise HTTPException(status_code=500, detail=error_type) from exc


@app.post("/incidents/{name}/enable")
async def enable_incident(name: str) -> JSONResponse:
    try:
        enable(name)
        log.warning("incident_enabled", service="control", payload={"name": name})
        return JSONResponse({"ok": True, "incidents": status()})
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/incidents/{name}/disable")
async def disable_incident(name: str) -> JSONResponse:
    try:
        disable(name)
        log.warning("incident_disabled", service="control", payload={"name": name})
        return JSONResponse({"ok": True, "incidents": status()})
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/stress-test")
async def trigger_stress_test(body: StressTestRequest) -> dict:
    features = ["qa", "summary", "translate", "search"]
    results = []
    
    async def worker(index: int):
        feat = random.choice(features)
        try:
            res = agent.run(
                user_id=f"stress_user_{index}",
                feature=feat,
                session_id=f"stress_sess_{index}",
                message=f"Automated UI stress test payload {index}",
            )
            return {"status": 200, "latency_ms": res.latency_ms, "feature": feat}
        except Exception as exc:
            record_error(type(exc).__name__, feature=feat, model=agent.model)
            return {"status": 500, "error": str(exc), "feature": feat}

    # Execute in background loop
    tasks = [worker(i) for i in range(body.requests)]
    outs = await asyncio.gather(*tasks)
    successes = [o for o in outs if o["status"] == 200]
    failures = [o for o in outs if o["status"] != 200]
    
    return {
        "ok": True,
        "total": len(outs),
        "success": len(successes),
        "failed": len(failures),
        "avg_latency_ms": round(sum(o["latency_ms"] for o in successes) / max(len(successes), 1), 1),
    }

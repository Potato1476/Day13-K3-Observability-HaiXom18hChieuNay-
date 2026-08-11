from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    user_id: str = Field(..., examples=["u_team_01"])
    session_id: str = Field(..., examples=["s_demo_01"])
    feature: str = Field(default="qa", examples=["qa", "summary"])
    message: str = Field(..., min_length=1)
    prompt_label: Literal["baseline", "candidate", "production"] = "production"


class ChatResponse(BaseModel):
    answer: str
    correlation_id: str
    trace_id: str | None = None
    latency_ms: int
    tokens_in: int
    tokens_out: int
    cost_usd: float
    quality_score: float
    prompt_name: str
    prompt_label: str
    prompt_version: str
    prompt_source: str


class PromptLabelUpdate(BaseModel):
    version: str = Field(..., examples=["local-v2"])


class LogRecord(BaseModel):
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    level: Literal["info", "warning", "error", "critical"]
    service: str
    event: str
    correlation_id: str
    env: str
    user_id_hash: str | None = None
    session_id: str | None = None
    feature: str | None = None
    model: str | None = None
    prompt_name: str | None = None
    prompt_label: str | None = None
    prompt_version: str | None = None
    prompt_source: str | None = None
    latency_ms: int | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_usd: float | None = None
    error_type: str | None = None
    tool_name: str | None = None
    payload: dict[str, Any] | None = None

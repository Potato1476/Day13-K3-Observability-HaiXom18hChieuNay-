from __future__ import annotations

import time
from dataclasses import dataclass

from . import metrics
from .mock_llm import FakeLLM
from .mock_rag import retrieve
from .otel_tracing import set_span_attributes, traced_span
from .pii import hash_user_id, summarize_text
from .prompt_management import resolve_prompt
from .tracing import get_langfuse_client, tracing_enabled


@dataclass
class AgentResult:
    answer: str
    latency_ms: int
    tokens_in: int
    tokens_out: int
    cost_usd: float
    quality_score: float
    prompt_name: str
    prompt_label: str
    prompt_version: str
    prompt_source: str


class LabAgent:
    def __init__(self, model: str = "claude-sonnet-4-5") -> None:
        self.model = model
        self.llm = FakeLLM(model=model)

    def run(
        self,
        user_id: str,
        feature: str,
        session_id: str,
        message: str,
        prompt_label: str = "production",
    ) -> AgentResult:
        with traced_span(
            "ai.agent.run",
            **{
                "day13.feature": feature,
                "gen_ai.request.model": self.model,
                "gen_ai.prompt.label": prompt_label,
            },
        ) as agent_span:
            started = time.perf_counter()
            with traced_span("rag.retrieve", **{"day13.feature": feature}) as rag_span:
                docs = retrieve(message)
                rag_span.set_attribute("rag.document_count", len(docs))

            langfuse_client = get_langfuse_client()
            with traced_span("prompt.resolve", **{"day13.feature": feature}) as prompt_span:
                prompt = resolve_prompt(
                    langfuse_client,
                    feature=feature,
                    docs=docs,
                    message=message,
                    enabled=tracing_enabled(),
                    label_override=prompt_label,
                )
                set_span_attributes(
                    prompt_span,
                    {
                        "gen_ai.prompt.name": prompt.name,
                        "gen_ai.prompt.version": prompt.version,
                        "gen_ai.prompt.label": prompt.label,
                        "gen_ai.prompt.source": prompt.source,
                    },
                )

            with traced_span(
                "llm.generate",
                **{"gen_ai.request.model": self.model, "day13.feature": feature},
            ) as llm_span:
                response = self.llm.generate(prompt.text)
                set_span_attributes(
                    llm_span,
                    {
                        "gen_ai.usage.input_tokens": response.usage.input_tokens,
                        "gen_ai.usage.output_tokens": response.usage.output_tokens,
                    },
                )

            with traced_span("quality.calculate") as quality_span:
                quality_score = self._heuristic_quality(message, response.text, docs)
                quality_span.set_attribute("day13.quality_score", quality_score)

            latency_ms = int((time.perf_counter() - started) * 1000)
            cost_usd = self._estimate_cost(
                response.usage.input_tokens, response.usage.output_tokens
            )

            langfuse_client.update_current_trace(
                user_id=hash_user_id(user_id),
                session_id=session_id,
                tags=["lab", feature, self.model],
                metadata={
                    "prompt_name": prompt.name,
                    "prompt_label": prompt.label,
                    "prompt_version": prompt.version,
                    "prompt_source": prompt.source,
                },
            )
            langfuse_client.update_current_generation(
                model=self.model,
                metadata={
                    "doc_count": len(docs),
                    "query_preview": summarize_text(message),
                    "prompt_name": prompt.name,
                    "prompt_label": prompt.label,
                    "prompt_version": prompt.version,
                    "prompt_source": prompt.source,
                    "prompt_fetch_error": prompt.fetch_error,
                },
                usage_details={
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                },
                cost_details={"total": cost_usd},
                prompt=prompt.managed_prompt,
            )

            with traced_span("metrics.record"):
                metrics.record_request(
                    latency_ms=latency_ms,
                    cost_usd=cost_usd,
                    tokens_in=response.usage.input_tokens,
                    tokens_out=response.usage.output_tokens,
                    quality_score=quality_score,
                    feature=feature,
                )

            set_span_attributes(
                agent_span,
                {
                    "day13.latency_ms": latency_ms,
                    "day13.cost_usd": cost_usd,
                    "day13.quality_score": quality_score,
                    "gen_ai.usage.input_tokens": response.usage.input_tokens,
                    "gen_ai.usage.output_tokens": response.usage.output_tokens,
                    "gen_ai.prompt.version": prompt.version,
                    "gen_ai.prompt.label": prompt.label,
                    "gen_ai.prompt.source": prompt.source,
                },
            )

            return AgentResult(
                answer=response.text,
                latency_ms=latency_ms,
                tokens_in=response.usage.input_tokens,
                tokens_out=response.usage.output_tokens,
                cost_usd=cost_usd,
                quality_score=quality_score,
                prompt_name=prompt.name,
                prompt_label=prompt.label,
                prompt_version=prompt.version,
                prompt_source=prompt.source,
            )

    def _estimate_cost(self, tokens_in: int, tokens_out: int) -> float:
        input_cost = (tokens_in / 1_000_000) * 3
        output_cost = (tokens_out / 1_000_000) * 15
        return round(input_cost + output_cost, 6)

    def _heuristic_quality(self, question: str, answer: str, docs: list[str]) -> float:
        score = 0.5
        if docs:
            score += 0.2
        if len(answer) > 40:
            score += 0.1
        if question.lower().split()[0:1] and any(token in answer.lower() for token in question.lower().split()[:3]):
            score += 0.1
        if "[REDACTED" in answer:
            score -= 0.2
        return round(max(0.0, min(1.0, score)), 2)

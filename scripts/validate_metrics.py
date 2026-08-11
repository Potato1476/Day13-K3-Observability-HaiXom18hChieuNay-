"""Kiểm tra nhanh endpoint /metrics có đủ series cho 6 panel Prometheus hay chưa.

Chạy khi API đang chạy và đã có traffic:

    uvicorn app.main:app --reload --env-file .env --host 0.0.0.0
    python scripts/load_test.py
    python scripts/validate_metrics.py

Giống validate_logs.py, đây chỉ là kiểm tra kỹ thuật nhanh, không phải điểm cuối.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx
from prometheus_client.parser import text_string_to_metric_families

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.cli import configure_utf8_stdio

DEFAULT_APP_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")
DEFAULT_PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")


def fetch_metrics(base_url: str) -> str:
    response = httpx.get(f"{base_url.rstrip('/')}/metrics", timeout=10.0)
    response.raise_for_status()
    return response.text


def collect_samples(exposition: str) -> list:
    samples = []
    for family in text_string_to_metric_families(exposition):
        samples.extend(family.samples)
    return samples


def total(samples: list, name: str, **labels: str) -> float:
    return sum(
        sample.value
        for sample in samples
        if sample.name == name
        and all(sample.labels.get(key) == value for key, value in labels.items())
    )


def check_prometheus_target(prometheus_url: str) -> None:
    try:
        response = httpx.get(f"{prometheus_url.rstrip('/')}/api/v1/targets", timeout=5.0)
        response.raise_for_status()
        targets = response.json()["data"]["activeTargets"]
    except Exception as exc:  # Prometheus là tùy chọn khi chạy kiểm tra nhanh
        print(f"\n[i] Không đọc được Prometheus tại {prometheus_url}: {type(exc).__name__}")
        print("    Chạy 'docker compose up -d' nếu bạn cần dashboard và alert.")
        return

    lab_targets = [
        target for target in targets if target["labels"].get("job") == "day13-lab-api"
    ]
    if not lab_targets:
        print("\n[!] Prometheus chạy nhưng không có target 'day13-lab-api'.")
        return
    for target in lab_targets:
        health = target.get("health", "unknown")
        marker = "+" if health == "up" else "-"
        print(f"\n{marker} Prometheus target {target['scrapeUrl']}: {health}")
        if health != "up":
            print(f"    lastError: {target.get('lastError') or 'không có'}")


def main() -> int:
    configure_utf8_stdio()
    parser = argparse.ArgumentParser(description="Kiểm tra metrics Prometheus của Day 13")
    parser.add_argument("--url", default=DEFAULT_APP_URL, help="Base URL của API")
    parser.add_argument(
        "--prometheus-url",
        default=DEFAULT_PROMETHEUS_URL,
        help="Base URL của Prometheus (bỏ qua nếu chưa chạy Docker)",
    )
    args = parser.parse_args()

    try:
        exposition = fetch_metrics(args.url)
    except Exception as exc:
        print(f"Error: không gọi được {args.url}/metrics ({type(exc).__name__}).")
        print("Hãy chạy API trước: uvicorn app.main:app --reload --env-file .env --host 0.0.0.0")
        return 1

    samples = collect_samples(exposition)
    requests_success = total(samples, "ai_requests_total", status="success")
    requests_error = total(samples, "ai_requests_total", status="error")
    latency_count = total(samples, "ai_request_latency_seconds_count")
    latency_sum = total(samples, "ai_request_latency_seconds_sum")
    tokens_in = total(samples, "ai_tokens_total", direction="input")
    tokens_out = total(samples, "ai_tokens_total", direction="output")
    cost = total(samples, "ai_cost_usd_total")
    quality_count = total(samples, "ai_quality_score_count")
    quality_sum = total(samples, "ai_quality_score_sum")
    errors = total(samples, "ai_errors_total")

    print("--- Prometheus Exposition Check ---")
    print(f"Endpoint: {args.url}/metrics")
    print(f"Số sample đọc được: {len(samples)}")
    print(f"ai_requests_total: success={requests_success:.0f} error={requests_error:.0f}")
    print(f"ai_request_latency_seconds: count={latency_count:.0f} sum={latency_sum:.3f}s")
    print(f"ai_tokens_total: input={tokens_in:.0f} output={tokens_out:.0f}")
    print(f"ai_cost_usd_total: {cost:.6f}")
    print(f"ai_quality_score: count={quality_count:.0f} sum={quality_sum:.2f}")
    print(f"ai_errors_total: {errors:.0f}")

    print("\n--- Panel Readiness (Estimates) ---")
    score = 0
    checks = (
        ("traffic", requests_success > 0, 20, "ai_requests_total chưa tăng"),
        ("latency", latency_count > 0, 20, "chưa observe ai_request_latency_seconds"),
        ("tokens", tokens_in > 0 and tokens_out > 0, 15, "thiếu ai_tokens_total input/output"),
        ("cost", cost > 0, 15, "chưa cộng ai_cost_usd_total"),
        ("quality", quality_count > 0, 15, "chưa observe ai_quality_score"),
        (
            "errors",
            errors > 0 and requests_error > 0,
            15,
            "chưa có mẫu lỗi; chạy inject_incident.py --scenario tool_fail rồi load_test.py",
        ),
    )
    for panel, ok, weight, hint in checks:
        if ok:
            score += weight
            print(f"+ [PASSED] panel {panel}")
        else:
            print(f"- [FAILED] panel {panel}: {hint}")

    print(f"\nEstimated Score: {score}/100")
    check_prometheus_target(args.prometheus_url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

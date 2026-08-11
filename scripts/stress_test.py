from __future__ import annotations

import argparse
import concurrent.futures
import json
import random
import sys
import time
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.cli import configure_utf8_stdio

DEFAULT_URL = "http://127.0.0.1:8000"
QUERIES_FILE = REPO_ROOT / "data" / "sample_queries.jsonl"


def load_queries() -> list[dict]:
    if not QUERIES_FILE.exists():
        return [
            {
                "user_id": f"usr_{i}",
                "session_id": f"sess_{i}",
                "feature": random.choice(["qa", "summary", "translate", "search"]),
                "message": f"Stress test message {i}",
            }
            for i in range(10)
        ]
    return [
        json.loads(line)
        for line in QUERIES_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def run_stress_test(
    url: str, concurrency: int, total_requests: int, duration_sec: float | None
) -> None:
    queries = load_queries()
    results: list[tuple[int, float]] = []
    errors = 0
    start_time = time.perf_counter()

    def send_one(client: httpx.Client, payload: dict) -> tuple[int, float]:
        t0 = time.perf_counter()
        try:
            res = client.post(f"{url.rstrip('/')}/chat", json=payload, timeout=15.0)
            latency_ms = (time.perf_counter() - t0) * 1000
            return (res.status_code, latency_ms)
        except Exception:
            latency_ms = (time.perf_counter() - t0) * 1000
            return (500, latency_ms)

    print(f"==================================================")
    print(f"🚀 Starting Stress Test")
    print(f"Target: {url}/chat")
    print(f"Concurrency: {concurrency} workers")
    if duration_sec:
        print(f"Duration: {duration_sec} seconds")
    else:
        print(f"Total Requests: {total_requests}")
    print(f"==================================================")

    stop = False
    completed = 0

    with httpx.Client(timeout=20.0) as client:
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures: list[concurrent.futures.Future[tuple[int, float]]] = []

            def worker() -> tuple[int, float]:
                payload = random.choice(queries)
                return send_one(client, payload)

            # Submit initial batch
            batch_size = max(concurrency * 2, total_requests if not duration_sec else 100)
            for _ in range(min(batch_size, total_requests if not duration_sec else 999999)):
                futures.append(executor.submit(worker))

            while futures:
                # Check duration stop
                if duration_sec and (time.perf_counter() - start_time) >= duration_sec:
                    stop = True

                done, pending = concurrent.futures.wait(
                    futures, timeout=0.1, return_when=concurrent.futures.FIRST_COMPLETED
                )

                for f in done:
                    futures.remove(f)
                    try:
                        status_code, lat = f.result()
                        results.append((status_code, lat))
                        completed += 1
                        if status_code != 200:
                            errors += 1
                    except Exception:
                        errors += 1
                        completed += 1

                    # Replenish task if needed
                    if not stop:
                        if duration_sec:
                            futures.append(executor.submit(worker))
                        elif completed + len(futures) < total_requests:
                            futures.append(executor.submit(worker))

                if stop and not duration_sec:
                    break

    elapsed = time.perf_counter() - start_time
    latencies = [lat for _, lat in results]
    latencies.sort()

    p50 = latencies[int(len(latencies) * 0.50)] if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    rps = completed / elapsed if elapsed > 0 else 0

    print(f"\n==================================================")
    print(f"📊 STRESS TEST RESULTS")
    print(f"==================================================")
    print(f"Total Completed:   {completed}")
    print(f"Successful (200):  {completed - errors}")
    print(f"Failed (non-200):  {errors} ({errors/max(completed,1)*100:.1f}%)")
    print(f"Total Duration:    {elapsed:.2f} seconds")
    print(f"Throughput (RPS):  {rps:.2f} req/sec")
    print(f"Latency Avg:       {avg_lat:.1f} ms")
    print(f"Latency P50:       {p50:.1f} ms")
    print(f"Latency P95:       {p95:.1f} ms")
    print(f"Latency P99:       {p99:.1f} ms")
    print(f"==================================================")


def main() -> None:
    configure_utf8_stdio()
    parser = argparse.ArgumentParser(description="Stress test for Day 13 API")
    parser.add_argument("--url", default=DEFAULT_URL, help="Base API URL")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent threads")
    parser.add_argument("--requests", type=int, default=50, help="Total requests to send")
    parser.add_argument(
        "--duration", type=float, default=None, help="Duration in seconds (overrides --requests)"
    )
    args = parser.parse_args()

    run_stress_test(
        url=args.url,
        concurrency=args.concurrency,
        total_requests=args.requests,
        duration_sec=args.duration,
    )


if __name__ == "__main__":
    main()

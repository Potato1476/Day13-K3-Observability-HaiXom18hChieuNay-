from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]


def run_validator(config_path: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "validate_dashboard.py"),
            "--config",
            str(config_path),
            *extra,
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )


def write_variant(tmp_path: Path, mutate) -> Path:
    payload = yaml.safe_load(
        (REPO_ROOT / "config" / "dashboard.yaml").read_text(encoding="utf-8")
    )
    mutate(payload["dashboard"])
    config_path = tmp_path / "dashboard.yaml"
    config_path.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    return config_path


def test_repository_dashboard_contract_is_valid() -> None:
    result = run_validator(REPO_ROOT / "config" / "dashboard.yaml")

    assert result.returncode == 0, result.stdout + result.stderr
    assert "6/6 panel" in result.stdout


def test_validator_rejects_panel_without_threshold(tmp_path: Path) -> None:
    config_path = write_variant(
        tmp_path, lambda dashboard: dashboard["panels"][0].pop("threshold")
    )

    result = run_validator(config_path)

    assert result.returncode == 1
    assert "latency.threshold" in result.stdout


def test_validator_rejects_panel_without_promql(tmp_path: Path) -> None:
    config_path = write_variant(
        tmp_path, lambda dashboard: dashboard["panels"][0].pop("queries", None)
    )

    result = run_validator(config_path)

    assert result.returncode == 1
    assert "latency.queries" in result.stdout


def test_validator_rejects_aggregation_without_its_own_query(tmp_path: Path) -> None:
    config_path = write_variant(
        tmp_path, lambda dashboard: dashboard["panels"][0]["queries"].pop("p99")
    )

    result = run_validator(config_path)

    assert result.returncode == 1
    assert "p99" in result.stdout


def test_validator_rejects_promql_referencing_an_unexported_metric(tmp_path: Path) -> None:
    def break_metric_name(dashboard: dict) -> None:
        panel = dashboard["panels"][0]
        panel["metrics"] = ["ai_request_latency_second_bucket"]
        panel["queries"] = {
            aggregation: query.replace(
                "ai_request_latency_seconds_bucket", "ai_request_latency_second_bucket"
            )
            for aggregation, query in panel["queries"].items()
        }

    config_path = write_variant(tmp_path, break_metric_name)

    result = run_validator(config_path)

    assert result.returncode == 1
    assert "ai_request_latency_second_bucket" in result.stdout


def test_validator_rejects_a_non_prometheus_datasource(tmp_path: Path) -> None:
    config_path = write_variant(
        tmp_path, lambda dashboard: dashboard.update({"datasource": "data/logs.jsonl"})
    )

    result = run_validator(config_path)

    assert result.returncode == 1
    assert "datasource" in result.stdout


def test_released_alert_rules_still_need_student_work() -> None:
    """Alert rules đi kèm repo là placeholder hợp lệ; validator phải nói rõ điều đó."""
    result = run_validator(REPO_ROOT / "config" / "dashboard.yaml", "--alerts")

    assert result.returncode == 1
    assert "CHƯA HOÀN THIỆN" in result.stdout
    assert "placeholder" in result.stdout


def test_completed_alert_rules_pass(tmp_path: Path) -> None:
    rules = {
        "groups": [
            {
                "name": "day13-ai-observability",
                "interval": "30s",
                "rules": [
                    {
                        "alert": f"AiLatencyHigh{index}",
                        "expr": (
                            "histogram_quantile(0.95, sum by (le) "
                            "(rate(ai_request_latency_seconds_bucket[5m]))) > 3"
                        ),
                        "for": "5m",
                        "labels": {"severity": "warning", "owner": "team-a"},
                        "annotations": {
                            "summary": "Người dùng chờ quá 3 giây ở p95",
                            "runbook_url": "docs/alerts.md#alert-1",
                        },
                    }
                    for index in range(3)
                ],
            }
        ]
    }
    alerts_path = tmp_path / "alert_rules.yaml"
    alerts_path.write_text(
        yaml.safe_dump(rules, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )

    result = run_validator(REPO_ROOT / "config" / "dashboard.yaml", "--alerts", str(alerts_path))

    assert result.returncode == 0, result.stdout + result.stderr
    assert "HỢP LỆ: mọi alert" in result.stdout

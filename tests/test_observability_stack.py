from __future__ import annotations

import json
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_prometheus_scrapes_the_api_exporter_and_loads_alerts() -> None:
    config = yaml.safe_load(
        (REPO_ROOT / "observability/prometheus/prometheus.yml").read_text(
            encoding="utf-8"
        )
    )

    job = config["scrape_configs"][0]
    assert job["job_name"] == "day13-ai-api"
    assert job["metrics_path"] == "/prometheus"
    assert job["static_configs"][0]["targets"] == ["host.docker.internal:8000"]
    assert config["rule_files"] == ["/etc/prometheus/alerts.yml"]


def test_grafana_dashboard_has_exactly_the_six_lab_panels() -> None:
    dashboard = json.loads(
        (REPO_ROOT / "observability/grafana/dashboards/day13-ai-observability.json")
        .read_text(encoding="utf-8")
    )

    assert dashboard["time"] == {"from": "now-1h", "to": "now"}
    assert dashboard["refresh"] == "30s"
    assert [panel["title"] for panel in dashboard["panels"]] == [
        "Latency percentiles",
        "Request traffic",
        "Error rate and breakdown",
        "Cost over time",
        "Input and output tokens",
        "Quality proxy",
    ]
    assert all(panel["targets"] for panel in dashboard["panels"])
    assert all(panel["fieldConfig"]["defaults"]["unit"] for panel in dashboard["panels"])
    assert all(
        len(panel["fieldConfig"]["defaults"]["thresholds"]["steps"]) >= 2
        for panel in dashboard["panels"]
    )


def test_prometheus_defines_three_slo_alerts() -> None:
    alert_config = yaml.safe_load(
        (REPO_ROOT / "observability/prometheus/alerts.yml").read_text(encoding="utf-8")
    )

    rules = alert_config["groups"][0]["rules"]
    assert {rule["alert"] for rule in rules} == {
        "Day13HighLatencyP95",
        "Day13HighErrorRate",
        "Day13LowQualityScore",
    }
    assert all(rule["for"] for rule in rules)
    assert all(rule["annotations"]["runbook_url"] for rule in rules)

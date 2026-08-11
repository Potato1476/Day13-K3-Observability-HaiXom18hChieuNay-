from __future__ import annotations

from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from app.main import app


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_console_is_served_with_embedded_grafana_and_test_controls() -> None:
    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "Observability Console" in response.text
    assert 'id="grafana-frame"' in response.text
    assert 'id="run-stress"' in response.text
    assert 'id="quick-preset"' in response.text
    assert 'id="run-quick"' in response.text
    assert 'id="run-progress-track"' in response.text
    assert 'id="run-progress-percent"' in response.text
    assert 'data-incident="rag_slow"' in response.text
    assert 'id="log-stream"' in response.text
    assert 'id="trace-list"' in response.text
    assert 'id="open-jaeger"' in response.text
    assert 'id="prompt-label"' in response.text
    assert 'id="promote-prompt"' in response.text
    assert 'id="rollback-prompt"' in response.text
    assert "Nguyễn Gia Bảo" in response.text


def test_console_assets_are_served() -> None:
    with TestClient(app) as client:
        css = client.get("/static/console.css")
        javascript = client.get("/static/console.js")

    assert css.status_code == 200
    assert "--accent" in css.text
    assert javascript.status_code == 200
    assert 'fetchWithTimeout("/health"' in javascript.text
    assert '"/chat"' in javascript.text
    assert '"tool_fail"' in javascript.text
    assert "/observability/logs" in javascript.text
    assert 'new URLSearchParams({ limit: "500" })' in javascript.text
    assert "syncLogFilter: false" in javascript.text
    assert "/observability/traces" in javascript.text
    assert "/prompts/labels/production" in javascript.text
    assert "/prompts/rollback" in javascript.text


def test_grafana_compose_configuration_allows_embedding() -> None:
    compose = yaml.safe_load(
        (REPO_ROOT / "compose.observability.yaml").read_text(encoding="utf-8")
    )

    environment = compose["services"]["grafana"]["environment"]
    assert environment["GF_SECURITY_ALLOW_EMBEDDING"] == "true"
    assert environment["GF_AUTH_ANONYMOUS_ENABLED"] == "true"

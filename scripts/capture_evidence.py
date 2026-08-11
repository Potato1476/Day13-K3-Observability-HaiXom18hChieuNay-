from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_DIR = REPO_ROOT / "submission" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def capture_all() -> None:
    print(f"Starting Playwright evidence capture to {EVIDENCE_DIR}...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        # 1. Grafana Dashboard
        try:
            print("Capturing Grafana Dashboard...")
            page.goto("http://localhost:3001/d/day13-ai-observability/day-13-ai-observability?kiosk", timeout=15000)
            page.wait_for_timeout(3000)
            page.screenshot(path=str(EVIDENCE_DIR / "grafana_dashboard.png"), full_page=True)
            print("Saved grafana_dashboard.png")
        except Exception as e:
            print(f"Error capturing Grafana: {e}")

        # 2. Prometheus Targets
        try:
            print("Capturing Prometheus Targets...")
            page.goto("http://localhost:9090/targets", timeout=15000)
            page.wait_for_timeout(2000)
            page.screenshot(path=str(EVIDENCE_DIR / "prometheus_targets.png"), full_page=True)
            print("Saved prometheus_targets.png")
        except Exception as e:
            print(f"Error capturing Prometheus Targets: {e}")

        # 3. Prometheus Rules
        try:
            print("Capturing Prometheus Rules...")
            page.goto("http://localhost:9090/rules", timeout=15000)
            page.wait_for_timeout(2000)
            page.screenshot(path=str(EVIDENCE_DIR / "prometheus_rules.png"), full_page=True)
            print("Saved prometheus_rules.png")
        except Exception as e:
            print(f"Error capturing Prometheus Rules: {e}")

        # 4. Observability Studio Web App
        try:
            print("Capturing Observability Studio App...")
            for port in [5173, 5174, 5175, 5176, 5177, 5178, 5179]:
                try:
                    res = page.goto(f"http://localhost:{port}", timeout=3000)
                    if res and res.status == 200:
                        page.wait_for_timeout(2000)
                        page.screenshot(path=str(EVIDENCE_DIR / "observability_studio_app.png"), full_page=True)
                        print(f"Saved observability_studio_app.png from port {port}")
                        break
                except Exception:
                    continue
        except Exception as e:
            print(f"Error capturing Observability Studio: {e}")

        browser.close()

    print("\nEvidence capture completed!")


if __name__ == "__main__":
    capture_all()

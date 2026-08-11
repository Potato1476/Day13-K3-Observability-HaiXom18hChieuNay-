from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.cli import configure_utf8_stdio
from app.metrics import is_exported_metric


REQUIRED_PANEL_IDS = frozenset(
    {"latency", "traffic", "errors", "cost", "tokens", "quality"}
)
REQUIRED_PANEL_FIELDS = (
    "title",
    "source",
    "metrics",
    "aggregations",
    "queries",
    "unit",
    "threshold",
)
DATASOURCE = "prometheus"
# Mọi series của lab đều bắt đầu bằng ai_; dùng để bắt lỗi gõ sai tên metric.
LAB_METRIC_PATTERN = re.compile(r"\bai_[a-z0-9_]+\b")
PLACEHOLDER_EXPR = "vector(0)"


class DashboardConfigError(ValueError):
    pass


def _validate_panel_queries(panel_id: str, panel: dict) -> None:
    queries = panel["queries"]
    if not isinstance(queries, dict):
        raise DashboardConfigError(
            f"'{panel_id}.queries' phải là map từ aggregation sang câu PromQL"
        )

    missing = [name for name in panel["aggregations"] if name not in queries]
    if missing:
        raise DashboardConfigError(
            f"'{panel_id}.queries' thiếu PromQL cho: {', '.join(missing)}"
        )
    for name, expression in queries.items():
        if not isinstance(expression, str) or not expression.strip():
            raise DashboardConfigError(f"'{panel_id}.queries.{name}' phải là PromQL không rỗng")

    joined = " ".join(str(expression) for expression in queries.values())

    for referenced in sorted(set(LAB_METRIC_PATTERN.findall(joined))):
        if not is_exported_metric(referenced):
            raise DashboardConfigError(
                f"'{panel_id}.queries' dùng metric app không export: {referenced}"
            )

    for metric in panel["metrics"]:
        if not isinstance(metric, str) or not is_exported_metric(metric):
            raise DashboardConfigError(
                f"'{panel_id}.metrics' chứa metric app không export: {metric}"
            )
        if metric not in joined:
            raise DashboardConfigError(
                f"'{panel_id}.metrics' khai báo {metric} nhưng không PromQL nào dùng tới"
            )


def load_dashboard_config(path: Path) -> dict:
    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DashboardConfigError(f"Không tìm thấy dashboard config: {path}") from exc
    except yaml.YAMLError as exc:
        raise DashboardConfigError(f"Dashboard config không phải YAML hợp lệ: {exc}") from exc

    dashboard = payload.get("dashboard") if isinstance(payload, dict) else None
    if not isinstance(dashboard, dict):
        raise DashboardConfigError("Thiếu object 'dashboard'")
    if dashboard.get("schema_version") != 2:
        raise DashboardConfigError("'dashboard.schema_version' phải bằng 2")
    if dashboard.get("datasource") != DATASOURCE:
        raise DashboardConfigError("'dashboard.datasource' phải là 'prometheus'")
    if dashboard.get("time_range_minutes") != 60:
        raise DashboardConfigError("'dashboard.time_range_minutes' phải bằng 60")
    refresh_seconds = dashboard.get("refresh_seconds")
    if not isinstance(refresh_seconds, int) or not 15 <= refresh_seconds <= 30:
        raise DashboardConfigError("'dashboard.refresh_seconds' phải nằm trong khoảng 15–30")

    panels = dashboard.get("panels")
    if not isinstance(panels, list) or len(panels) != 6:
        raise DashboardConfigError("Dashboard phải có đúng 6 panel")
    panel_ids = {
        panel.get("id") for panel in panels if isinstance(panel, dict) and panel.get("id")
    }
    if panel_ids != REQUIRED_PANEL_IDS:
        missing = ", ".join(sorted(REQUIRED_PANEL_IDS - panel_ids)) or "không"
        extra = ", ".join(sorted(panel_ids - REQUIRED_PANEL_IDS)) or "không"
        raise DashboardConfigError(
            f"Panel ID không đúng; thiếu: {missing}; không hỗ trợ: {extra}"
        )

    for panel in panels:
        if not isinstance(panel, dict):
            raise DashboardConfigError("Mỗi dashboard panel phải là một YAML object")
        panel_id = panel["id"]
        for field in REQUIRED_PANEL_FIELDS:
            if panel.get(field) in (None, "", [], {}):
                raise DashboardConfigError(f"Thiếu hoặc rỗng: {panel_id}.{field}")
        if panel["source"] != DATASOURCE:
            raise DashboardConfigError(f"'{panel_id}.source' phải là 'prometheus'")
        if not all(isinstance(panel[field], list) for field in ("metrics", "aggregations")):
            raise DashboardConfigError(f"'{panel_id}.metrics/aggregations' phải là danh sách")

        _validate_panel_queries(panel_id, panel)

        threshold = panel["threshold"]
        if not isinstance(threshold, dict):
            raise DashboardConfigError(f"'{panel_id}.threshold' phải là một YAML object")
        if threshold.get("aggregation") not in panel["aggregations"]:
            raise DashboardConfigError(
                f"'{panel_id}.threshold.aggregation' phải thuộc aggregations của panel"
            )
        if threshold.get("operator") not in {"lte", "gte"}:
            raise DashboardConfigError(
                f"'{panel_id}.threshold.operator' chỉ nhận 'lte' hoặc 'gte'"
            )
        if not isinstance(threshold.get("value"), (int, float)):
            raise DashboardConfigError(f"'{panel_id}.threshold.value' phải là một số")

    return payload


def load_alert_rules(path: Path) -> list[dict]:
    """Kiểm tra cấu trúc file alert rules của Prometheus và trả về danh sách rule."""
    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DashboardConfigError(f"Không tìm thấy alert rules: {path}") from exc
    except yaml.YAMLError as exc:
        raise DashboardConfigError(f"Alert rules không phải YAML hợp lệ: {exc}") from exc

    groups = payload.get("groups") if isinstance(payload, dict) else None
    if not isinstance(groups, list) or not groups:
        raise DashboardConfigError("Alert rules phải có danh sách 'groups' không rỗng")

    rules: list[dict] = []
    for group in groups:
        if not isinstance(group, dict) or not group.get("name"):
            raise DashboardConfigError("Mỗi group phải có 'name'")
        group_rules = group.get("rules")
        if not isinstance(group_rules, list) or not group_rules:
            raise DashboardConfigError(f"Group '{group.get('name')}' phải có 'rules' không rỗng")
        for rule in group_rules:
            if not isinstance(rule, dict) or not rule.get("alert"):
                raise DashboardConfigError(f"Group '{group['name']}' có rule thiếu 'alert'")
            for field in ("expr", "for", "labels", "annotations"):
                if rule.get(field) in (None, "", {}):
                    raise DashboardConfigError(f"Alert '{rule['alert']}' thiếu '{field}'")
            rules.append(rule)

    if len(rules) < 3:
        raise DashboardConfigError(f"Cần tối thiểu 3 alert, đang có {len(rules)}")
    return rules


def report_alert_rules(rules: list[dict]) -> bool:
    """In trạng thái hoàn thiện của alert rules. Trả về True nếu không còn TODO."""
    incomplete: list[str] = []
    for rule in rules:
        name = str(rule["alert"])
        problems = []
        expression = str(rule["expr"]).strip()
        if PLACEHOLDER_EXPR in expression:
            problems.append("expr vẫn là placeholder vector(0)")
        elif not LAB_METRIC_PATTERN.search(expression):
            problems.append("expr không tham chiếu metric ai_* nào")
        else:
            unknown = [
                metric
                for metric in sorted(set(LAB_METRIC_PATTERN.findall(expression)))
                if not is_exported_metric(metric)
            ]
            if unknown:
                problems.append(f"expr dùng metric không export: {', '.join(unknown)}")
        if "TODO" in name:
            problems.append("tên alert vẫn còn TODO")
        if "TODO" in str(rule["labels"].get("severity", "")):
            problems.append("severity vẫn còn TODO")
        if "TODO" in str(rule["labels"].get("owner", "")):
            problems.append("owner vẫn còn TODO")
        if "TODO" in str(rule["annotations"].get("summary", "")):
            problems.append("summary vẫn còn TODO")
        if not rule["annotations"].get("runbook_url"):
            problems.append("thiếu runbook_url")
        if problems:
            incomplete.append(f"  - {name}: {'; '.join(problems)}")

    print(f"\n--- Alert rules ({len(rules)} alert) ---")
    if incomplete:
        print("CHƯA HOÀN THIỆN:")
        print("\n".join(incomplete))
        return False
    print("HỢP LỆ: mọi alert đã có expr PromQL, severity, owner, summary và runbook.")
    return True


def main() -> int:
    configure_utf8_stdio()
    parser = argparse.ArgumentParser(description="Kiểm tra dashboard contract của Day 13")
    parser.add_argument(
        "--config",
        type=Path,
        default=REPO_ROOT / "config" / "dashboard.yaml",
        help="Đường dẫn tới dashboard YAML",
    )
    parser.add_argument(
        "--alerts",
        nargs="?",
        const=REPO_ROOT / "config" / "alert_rules.yaml",
        type=Path,
        default=None,
        help="Kiểm tra thêm file alert rules của Prometheus",
    )
    args = parser.parse_args()

    try:
        load_dashboard_config(args.config)
    except DashboardConfigError as exc:
        print(f"KHÔNG HỢP LỆ: {exc}")
        return 1

    print(
        f"HỢP LỆ: {len(REQUIRED_PANEL_IDS)}/6 panel có trong dashboard contract "
        f"và mọi PromQL đều dùng metric app đang export."
    )

    if args.alerts is not None:
        try:
            rules = load_alert_rules(args.alerts)
        except DashboardConfigError as exc:
            print(f"KHÔNG HỢP LỆ: {exc}")
            return 1
        if not report_alert_rules(rules):
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

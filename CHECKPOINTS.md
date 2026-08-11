# Checkpoint buổi lab

## Checkpoint 0 — 0:00–0:30: Setup và baseline

- Làm theo [SETUP.md](SETUP.md); `docker compose up -d` phải chạy được, Langfuse ưu tiên chung/cloud.
- API chạy với `--host 0.0.0.0` và load test chạy được.
- Prometheus target `day13-lab-api` ở trạng thái `UP` tại http://localhost:9090/targets.
- Grafana mở được tại http://localhost:3001 với datasource Prometheus đã provisioning sẵn.
- Có `data/logs.jsonl`.
- Lưu baseline từ `python scripts/validate_logs.py` và `python scripts/validate_metrics.py` vào báo cáo.

## Checkpoint 1 — 0:30–1:30: Logging, PII và instrumentation

- Mỗi request có correlation ID hợp lệ.
- Log API có `user_id_hash`, `session_id`, `feature`, `model`, `env`.
- Email, số điện thoại và số thẻ thử nghiệm không xuất hiện nguyên văn trong log.
- `validate_logs.py` đạt tối thiểu 80/100.
- Hoàn thiện TODO trong `app/metrics.py`: latency histogram tính bằng giây, token theo `direction`, cost, quality và đường lỗi.
- `python scripts/validate_metrics.py` đạt 100/100; panel `errors` cần một lần chạy `inject_incident.py --scenario tool_fail` để có mẫu lỗi thật.

## Checkpoint 2 — 1:30–2:30: Dashboard, traces và prompt version

- `python scripts/validate_dashboard.py --alerts` báo hợp lệ.
- Dashboard Grafana có đủ 6 panel theo [`config/dashboard.yaml`](config/dashboard.yaml), làm theo [docs/DASHBOARD_SETUP.md](docs/DASHBOARD_SETUP.md).
- Mỗi panel có đơn vị đúng và SLO line hoặc threshold nhìn thấy được.
- Dashboard JSON đã export và commit vào `grafana/dashboards/`.
- Ba alert rule trong `config/alert_rules.yaml` dùng PromQL thật và nạp được vào Prometheus (http://localhost:9090/rules).
- Có ít nhất 10 traces với metadata.
- Làm theo [docs/PROMPT_VERSIONING.md](docs/PROMPT_VERSIONING.md): có prompt v1/v2; trace hiển thị `prompt_name`, `prompt_label` và `prompt_version`.
- Thực hiện được một lần đổi label hoặc rollback; không chấm chất lượng prompt.
- Chụp dashboard, trang `/rules`, hai trace prompt, thao tác rollback và kết quả validator vào `submission/evidence/`.

## Checkpoint 3 — 2:30–3:30: Challenge chính thức

Sau khi Lab Coach release `config/challenge.json`:

1. Chạy incident và input chính thức.
2. Xác định triệu chứng từ panel Grafana và PromQL.
3. Dùng trace Langfuse để khoanh vùng span bất thường.
4. Dùng log để chứng minh root cause.
5. Đề xuất fix và biện pháp phòng ngừa.

## Hoàn tất — 3:30–4:00: Báo cáo và demo

- Hoàn thiện `submission/REPORT.md`.
- Kiểm tra không có secret hoặc PII trong Git.
- Commit toàn bộ phần việc hợp lệ, gồm cả dashboard JSON và alert rules.
- Chuẩn bị demo ngắn theo luồng Metrics → Traces → Logs → Root cause.

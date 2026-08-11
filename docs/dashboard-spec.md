# Yêu cầu dashboard

Contract có thể kiểm tra bằng máy nằm tại `config/dashboard.yaml`. Hướng dẫn dựng và kiểm tra runtime nằm tại [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md).

Datasource là Prometheus. Mọi panel phải đọc từ metric do `app/metrics.py` export; không đọc trực tiếp `data/logs.jsonl` nữa.

Dashboard chính cần đủ 6 nhóm thông tin:

1. Latency P50/P95/P99 từ `ai_request_latency_seconds_bucket`.
2. Traffic: request/phút từ `ai_requests_total`.
3. Error rate và breakdown theo `error_type`.
4. Cost theo thời gian từ `ai_cost_usd_total`.
5. Tổng token input/output từ `ai_tokens_total`.
6. Quality proxy từ `ai_quality_score_sum` và `ai_quality_score_count`.

Tiêu chuẩn trình bày:

- Khoảng thời gian mặc định: 1 giờ.
- Tự refresh mỗi 15–30 giây.
- Có threshold hoặc SLO line.
- Ghi rõ đơn vị; latency tính bằng giây theo quy ước Prometheus.
- Chỉ giữ 6–8 panel quan trọng ở lớp chính.
- Screenshot phải nhìn được tên panel và khoảng thời gian.
- Dashboard JSON đã export phải được commit vào `grafana/dashboards/`.

Kiểm tra contract và alert rules trước khi chụp evidence:

```bash
python scripts/validate_dashboard.py --alerts
```

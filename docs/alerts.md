# Template Alert và Runbook

Mỗi alert phải dựa trên triệu chứng người dùng hoặc SLO, không dựa trực tiếp vào tên implementation nội bộ.

Alert của lab chạy trên Prometheus. Sửa trực tiếp [`config/alert_rules.yaml`](../config/alert_rules.yaml); cả thư mục `config/` được mount vào container tại `/etc/prometheus/lab/`.

## Cấu trúc một rule

```yaml
- alert: AiLatencyHigh
  expr: histogram_quantile(0.95, sum by (le) (rate(ai_request_latency_seconds_bucket[5m]))) > 3
  for: 5m
  labels:
    severity: warning
    owner: team-a
  annotations:
    summary: P95 latency vượt SLO 3 giây, người dùng phải chờ lâu bất thường
    runbook_url: docs/alerts.md#alert-1
```

- `expr`: PromQL trả về kết quả khi có vấn đề. Chỉ dùng metric app đang export.
- `for`: thời gian duy trì trước khi fire, để tránh báo động vì một spike ngắn.
- `severity` và `owner`: ai bị đánh thức và mức độ khẩn.
- `summary`: mô tả ảnh hưởng tới người dùng, không mô tả implementation.
- `runbook_url`: trỏ về đúng mục trong file này.

Threshold nên lấy từ `config/slo.yaml` để alert và SLO không mâu thuẫn nhau.

Kiểm tra sau khi sửa:

```bash
python scripts/validate_dashboard.py --alerts
docker compose exec prometheus promtool check rules /etc/prometheus/lab/alert_rules.yaml
docker compose restart prometheus
```

Dùng `docker compose restart prometheus` chứ đừng chỉ gọi `POST /-/reload`. Hầu hết editor lưu file theo kiểu atomic nên inode đổi sau mỗi lần lưu; reload có thể vẫn đọc nội dung cũ.

Xác nhận rule đã nạp tại http://localhost:9090/rules và trạng thái tại http://localhost:9090/alerts. Nếu Prometheus không khởi động lại được, chạy `docker compose logs prometheus` — lỗi cú pháp YAML hoặc PromQL sẽ chặn startup.

Lab không cấu hình Alertmanager. Bằng chứng cần nộp là rule đã nạp và trạng thái `PENDING`/`FIRING` khi bạn bật incident practice.

## Alert 1

- Tên:
- Severity:
- SLI/SLO liên quan:
- PromQL (`expr`):
- Điều kiện và thời gian duy trì (`for`):
- Ảnh hưởng tới người dùng:
- Ba bước kiểm tra đầu tiên:
- Mitigation tạm thời:
- Owner:

## Alert 2

- Tên:
- Severity:
- SLI/SLO liên quan:
- PromQL (`expr`):
- Điều kiện và thời gian duy trì (`for`):
- Ảnh hưởng tới người dùng:
- Ba bước kiểm tra đầu tiên:
- Mitigation tạm thời:
- Owner:

## Alert 3

- Tên:
- Severity:
- SLI/SLO liên quan:
- PromQL (`expr`):
- Điều kiện và thời gian duy trì (`for`):
- Ảnh hưởng tới người dùng:
- Ba bước kiểm tra đầu tiên:
- Mitigation tạm thời:
- Owner:

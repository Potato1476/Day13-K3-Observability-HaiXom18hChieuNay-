# Danh sách evidence cần thu thập

## Bắt buộc

- Kết quả cuối của `validate_logs.py`.
- Kết quả cuối của `validate_metrics.py`.
- Ảnh Prometheus `/targets` với `day13-lab-api` ở trạng thái `UP`.
- Danh sách có tối thiểu 10 traces.
- Một trace waterfall đầy đủ.
- Hai prompt version và trace hiển thị đúng name/label/version.
- Một bằng chứng đổi label hoặc rollback prompt.
- Log JSON có correlation ID và metadata.
- Log chứng minh PII đã được redact.
- Kết quả `python scripts/validate_dashboard.py --alerts` hợp lệ.
- Dashboard Grafana đủ 6 nhóm chỉ số, nhìn được đơn vị và threshold.
- Dashboard JSON đã export trong `grafana/dashboards/`.
- Alert rules đã nạp vào Prometheus (ảnh `/rules`) và runbook đã hoàn thiện.
- Evidence điều tra challenge: metric, trace ID và log line liên quan.

## Không bắt buộc

- So sánh trước/sau khi tối ưu chi phí.
- Audit log tách riêng.
- Custom metric hoặc automation do nhóm tự xây.

Ảnh phải đặt trong `submission/evidence/` và được dẫn lại bằng đường dẫn tương đối trong `submission/REPORT.md`.

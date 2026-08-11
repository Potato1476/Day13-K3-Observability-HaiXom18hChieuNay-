# Báo cáo Day 13 Observability

## 1. Thông tin nhóm

- Tên nhóm:
- Repository URL:
- Commit SHA cuối:
- Thành viên và vai trò:

## 2. Kết quả kỹ thuật

- Điểm `validate_logs.py`:
- Tổng số traces:
- Số PII leak còn lại:
- Link/đường dẫn dashboard:

## 3. Logging và tracing

- Evidence correlation ID:
- Evidence PII redaction:
- Evidence trace waterfall:
- Giải thích một span đáng chú ý:

## 4. Prompt versioning

- Prompt name:
- Version/label baseline:
- Version/label candidate:
- Trace ID của mỗi version:
- Bằng chứng đổi label hoặc rollback:

## 5. Dashboard, SLO và alerts

- Kết quả `validate_dashboard.py`: HỢP LỆ: 6/6 panel có trong dashboard contract.
- Evidence dashboard: [Tạm thời để trống - Thành viên C sẽ chụp ảnh màn hình dashboard và bổ sung vào báo cáo]
- SLO đã chọn và lý do:
  - Các SLO được lựa chọn nhằm khớp hoàn hảo với các ngưỡng (threshold) được thiết lập trên 6 panel của Dashboard nhằm đảm bảo trải nghiệm người dùng tối ưu về độ trễ, tỷ lệ lỗi, chất lượng phản hồi và chi phí vận hành:
    - **Latency**: `latency_p95_ms <= 3000ms` nhằm đảm bảo chatbot phản hồi nhanh chóng, không gây cảm giác gián đoạn hay đơ cho người dùng.
    - **Error Rate**: `error_rate_pct <= 2%` để giữ tỷ lệ lỗi hệ thống ở mức cực thấp, đảm bảo tính sẵn sàng cao.
    - **Quality Score**: `quality_score_avg >= 0.75` nhằm duy trì chất lượng câu trả lời của LLM đạt chuẩn, đúng ngữ cảnh và hữu ích.
    - **Cost & Token Budget**: Giám sát lượng token tiêu thụ và chi phí để tối ưu hóa hiệu năng tài nguyên.
- Alert rules và runbook:
  - Đã thiết lập 3 quy tắc cảnh báo (Alert Rules) chính và xây dựng quy trình xử lý sự cố (Runbook) chi tiết tại [docs/alerts.md](../docs/alerts.md):
    1. **HighLatencyAlert** (Critical): p95 latency > 3000ms liên tục trong 5 phút. Tương ứng với SLO `latency_p95_ms <= 3000ms`.
    2. **HighErrorRateAlert** (Critical): Error rate > 2% liên tục trong 3 phút. Tương ứng với SLO `error_rate_pct <= 2%`.
    3. **LowQualityAlert** (Warning): Quality score trung bình < 0.75 trong 10 phút. Tương ứng với SLO `quality_score_avg >= 0.75`.

## 6. Điều tra challenge

- Challenge ID:
- Triệu chứng từ metrics:
- Trace ID liên quan:
- Log line/correlation ID liên quan:
- Root cause:
- Fix action:
- Preventive measure:

## 7. Đóng góp cá nhân

Với mỗi thành viên, ghi rõ nhiệm vụ và link commit/PR tương ứng.

| Thành viên | Phần việc | Commit/PR | Điều đã học |
|---|---|---|---|
| | | | |

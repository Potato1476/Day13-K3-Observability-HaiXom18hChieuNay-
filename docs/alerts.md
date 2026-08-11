# Template Alert và Runbook

Mỗi alert phải dựa trên triệu chứng người dùng hoặc SLO, không dựa trực tiếp vào tên implementation nội bộ.

## Alert 1

- Tên: HighLatencyAlert
- Severity: Critical
- SLI/SLO liên quan: `latency_p95_ms <= 3000ms`
- Điều kiện và thời gian duy trì: p95 latency vượt quá 3000ms liên tục trong 5 phút.
- Ảnh hưởng tới người dùng: Người dùng bị phản hồi chậm hoặc đơ chatbot.
- Ba bước kiểm tra đầu tiên:
  1. Xem panel 'Latency percentiles' trên Dashboard.
  2. Tìm Trace ID bị chậm trên Langfuse.
  3. Tra cứu log trong `data/logs.jsonl` bằng `correlation_id` để tìm nguyên nhân.
- Mitigation tạm thời: Bật cache, hoặc chuyển đổi sang mô hình dự phòng nhanh hơn.
- Owner: Nguyen Tuan Anh

## Alert 2

- Tên: HighErrorRateAlert
- Severity: Critical
- SLI/SLO liên quan: `error_rate_pct <= 2%`
- Điều kiện và thời gian duy trì: Tỷ lệ lỗi vượt quá 2% liên tục trong 3 phút.
- Ảnh hưởng tới người dùng: Chatbot hiển thị lỗi hệ thống.
- Ba bước kiểm tra đầu tiên:
  1. Xem panel 'Error rate' trên Dashboard.
  2. Tìm Trace ID bị lỗi trên Langfuse.
  3. Lọc logs bằng `correlation_id` để xác định exception cụ thể.
- Mitigation tạm thời: Kích hoạt cơ chế tự động retry, hoặc kiểm tra trạng thái API key.
- Owner: Nguyen Tuan Anh

## Alert 3

- Tên: LowQualityAlert
- Severity: Warning
- SLI/SLO liên quan: `quality_score_avg >= 0.75`
- Điều kiện và thời gian duy trì: Điểm chất lượng trung bình dưới 0.75 trong 10 phút.
- Ảnh hưởng tới người dùng: LLM trả lời lạc đề, chất lượng thấp.
- Ba bước kiểm tra đầu tiên:
  1. Xem panel 'Quality proxy' trên Dashboard.
  2. Kiểm tra trace trong Langfuse xem prompt version nào đang chạy.
  3. So sánh output của prompt v1 và v2 để tìm nguyên nhân giảm chất lượng.
- Mitigation tạm thời: Rollback prompt version cũ hơn hoạt động ổn định.
- Owner: Nguyen Tuan Anh

# Gợi ý làm bài

## Khi log thiếu correlation ID

Theo dõi một request từ middleware đến response. Kiểm tra context có được xóa trước request mới, gán vào logger và trả lại trong response header hay chưa.

## Khi log thiếu metadata

Xác định metadata nào thuộc toàn request và metadata nào chỉ xuất hiện sau khi agent chạy xong. Bind context trước dòng `request_received` để các log sau dùng chung context.

## Khi còn PII trong log

Kiểm tra thứ tự processor: dữ liệu phải được scrub trước khi JSON được render và ghi xuống file. Thử với email, số điện thoại và số thẻ mẫu.

## Khi panel Grafana báo `No data`

Đi ngược đường dữ liệu, dừng ở chặng đầu tiên bị đứt:

1. `python scripts/validate_metrics.py` — series đã tồn tại chưa? Nếu chưa, TODO trong `app/metrics.py` chưa xong.
2. `curl http://127.0.0.1:8000/metrics | grep ai_` — app có export đúng tên metric không?
3. http://localhost:9090/targets — target `day13-lab-api` có `UP` không? `connection refused` nghĩa là uvicorn đang bind `127.0.0.1` thay vì `0.0.0.0`.
4. http://localhost:9090/graph — chạy thẳng câu PromQL. Nếu Prometheus trả rỗng thì lỗi nằm ở query, không nằm ở Grafana.
5. Time range của panel: counter mới tăng vài giây thì `rate(...[5m])` cần thời gian mới có số.

## Khi số trên panel trông vô lý

- Đường cost hoặc token chỉ đi lên và không bao giờ xuống: bạn đang vẽ thẳng counter. Bọc trong `rate()` hoặc `increase()`.
- Latency ra 0.15 trong khi log ghi 150: Prometheus dùng giây, log dùng mili giây. Đúng rồi, đổi đơn vị panel chứ đừng đổi code.
- P99 đứng yên ở một giá trị tròn: percentile đang bị chặn bởi bucket lớn nhất. Xem lại `LATENCY_BUCKETS_SECONDS`.
- Error rate luôn 0% dù có lỗi: mẫu số đúng nhưng tử số thiếu, hoặc `record_error` chưa đếm request lỗi vào `ai_requests_total`.

## Khi metrics báo xấu nhưng chưa biết nguyên nhân

1. Dùng metrics xác định khoảng thời gian và loại triệu chứng.
2. Mở một trace bất thường trong khoảng đó.
3. So sánh thời gian các span.
4. Tìm log có cùng correlation ID.
5. Chỉ kết luận khi evidence khớp ở cả ba lớp.

## Khi dashboard khó đọc

Mỗi panel cần tên, đơn vị, khoảng thời gian và threshold. Ưu tiên 6 panel chính thay vì thêm nhiều biểu đồ không phục vụ quyết định.

Chạy `python scripts/validate_dashboard.py --alerts` trước. Nếu validator qua nhưng dashboard vẫn sai, đối chiếu từng metric và câu PromQL với bảng trong [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md), đặc biệt `ai_request_latency_seconds_bucket` và cặp `ai_quality_score_sum`/`ai_quality_score_count`.

## Khi prompt luôn hiện `local-v1`

1. Kiểm tra `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` và `LANGFUSE_HOST`.
2. Kiểm tra prompt name/label trong `.env` có tồn tại trên đúng project không.
3. Khởi động lại API sau khi đổi `.env`.
4. Mở trace metadata: `prompt_source=local` nghĩa là chưa bật Langfuse; `local-fallback` nghĩa là đã bật nhưng fetch prompt lỗi.

Không sửa code để ghi giả version. Làm theo [PROMPT_VERSIONING.md](PROMPT_VERSIONING.md) và lấy trace thật làm evidence.

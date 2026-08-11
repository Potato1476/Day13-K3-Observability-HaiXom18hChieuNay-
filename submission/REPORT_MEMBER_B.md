# Báo cáo đóng góp Thành viên B — Security Engineer

## Thông tin và phạm vi

- Thành viên: **Nguyễn Lê Minh**
- Mã sinh viên: **2A202601573**
- Vai trò: **Security Engineer**
- Checkpoint: **CP1 — PII protection**

Nhánh này chỉ chứa phần PII scrubbing, regex patterns và kiểm chứng structured log không lộ PII. Middleware/correlation ID, metrics/dashboard, SLO/alerts, tracing/load test và điều tra challenge thuộc các thành viên khác nên không nằm trong contribution này.

## Công việc thực hiện

1. Hoàn thiện bộ scrub PII cho email, số điện thoại Việt Nam, CCCD, thẻ tín dụng và hộ chiếu Việt Nam.
2. Gắn processor scrub đệ quy vào pipeline structured logging trước bước render JSON. Processor xử lý chuỗi nằm trong dictionary, list và tuple, không chỉ các trường trực tiếp của `payload`.
3. Duy trì `hash_user_id()` để log chỉ sử dụng định danh người dùng dạng hash; message/answer preview được xử lý qua `summarize_text()` trước khi ghi.
4. Kiểm chứng độc lập bằng `scripts/validate_logs.py`; detector của validator không tái sử dụng regex từ ứng dụng.
5. Loại `trace_id`, `span_id` và `user_id_hash` khỏi vùng quét của validator vì chuỗi hex ngẫu nhiên có thể chứa dãy số giống PII. Các trường nghiệp vụ như payload, session và correlation ID vẫn được quét.

## Tệp bàn giao

| Tệp | Nội dung đóng góp |
|---|---|
| `app/pii.py` | Regex PII, hàm scrub, preview an toàn và hash user ID. |
| `app/logging_config.py` | Processor scrub đệ quy và đăng ký processor trong pipeline log. |
| `scripts/validate_logs.py` | Bộ dò leak độc lập và cơ chế tránh false positive từ ID kỹ thuật. |
| `tests/test_pii.py` | Kiểm chứng email và các định dạng số điện thoại Việt Nam. |
| `tests/test_validate_logs.py` | Kiểm chứng phát hiện PII thật và bỏ qua chuỗi ID kỹ thuật. |

## Regex được bảo vệ

| Loại PII | Ví dụ đầu vào | Kết quả thay thế |
|---|---|---|
| Email | `student@vinuni.edu.vn` | `[REDACTED_EMAIL]` |
| Điện thoại Việt Nam | `090 123 4567`, `+84 90 123 4567` | `[REDACTED_PHONE_VN]` |
| CCCD | chuỗi 12 chữ số | `[REDACTED_CCCD]` |
| Thẻ tín dụng | 16 chữ số, có thể phân tách bằng dấu cách hoặc gạch ngang | `[REDACTED_CREDIT_CARD]` |
| Hộ chiếu Việt Nam | một chữ cái in hoa và 7–8 chữ số | `[REDACTED_PASSPORT_VN]` |

## Cách kiểm chứng

```bash
python -m pytest -q tests/test_pii.py tests/test_validate_logs.py
python scripts/validate_logs.py
```

Lệnh validator thứ hai cần `data/logs.jsonl` được sinh từ ít nhất hai request hoàn chỉnh để chấm cả schema, enrichment và correlation ID. Tiêu chí riêng của Thành viên B đạt khi kết quả ghi `Potential PII leaks detected: 0` và `[PASSED] PII scrubbing`.

## Kết quả bàn giao

Structured logs được scrub trước khi serialize xuống JSONL; PII trong các cấu trúc lồng nhau không còn bị bỏ sót. Validator vẫn phát hiện dữ liệu người dùng thật nhưng không báo nhầm các trace/span/hash ID ngẫu nhiên, tạo đầu vào telemetry an toàn cho các phần metrics, dashboard, alerts và điều tra sự cố.

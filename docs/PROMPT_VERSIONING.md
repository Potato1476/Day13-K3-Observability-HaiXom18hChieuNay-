# Prompt versioning cơ bản

Mục tiêu của phần này là biết một request đã dùng prompt nào và có thể rollback an toàn. Đây không phải bài tối ưu prompt hoặc A/B testing.

## Prompt contract

Tạo text prompt tên `day13-chat` trên Langfuse. Prompt phải giữ ba biến:

```text
Feature={{feature}}
Docs={{docs}}
Question={{message}}
```

App lấy prompt theo hai biến môi trường:

```dotenv
LANGFUSE_PROMPT_NAME=day13-chat
LANGFUSE_PROMPT_LABEL=production
```

Nếu Langfuse không khả dụng, app dùng template local và trace metadata ghi `prompt_source=local` hoặc `local-fallback` thay vì giả vờ đã lấy được prompt managed.

## Việc cần làm

1. Tạo version 1, gắn labels `baseline` và `production`.
2. Tạo version 2 với một thay đổi nhỏ về format hoặc độ dài câu trả lời, gắn label `candidate`.
3. Chạy cùng một input với `LANGFUSE_PROMPT_LABEL=baseline` và `candidate`.
4. Mở hai trace, kiểm tra `prompt_name`, `prompt_label`, `prompt_version` và prompt link.
5. Chuyển label `production` sang version 2, chạy lại một request.
6. Rollback `production` về version 1 và lưu ảnh evidence.

Không chấm prompt nào “hay hơn”. Điểm nằm ở khả năng truy xuất version, đổi label và rollback có bằng chứng.

## Đổi label bằng UI

Tab **Traces** của `frontend/` có panel *Prompt Version Control* làm được bước 3 và bước 5 mà không phải sửa `.env` rồi restart API:

- Panel hiện `prompt_name`, `prompt_label`, `prompt_version` và `prompt_source` đang có hiệu lực.
- Ba nút `baseline` / `candidate` / `production` gọi `POST /prompt/label` để đổi label ngay trong tiến trình.
- Mỗi lần đổi ghi một log `prompt_label_changed` chứa label cũ, label mới và version — dùng làm evidence rollback.

Label đổi theo cách này không được ghi vào `.env`, nên restart API sẽ quay lại giá trị ban đầu. Việc tạo version và gắn label trên Langfuse vẫn phải làm trong Langfuse UI; panel chỉ chọn label nào đang được dùng.

Nếu panel hiện `prompt_source=local-fallback`, prompt hoặc label đó chưa tồn tại trên project — tạo trước trong Langfuse rồi bấm Refresh.

## Evidence

- Một ảnh danh sách hai prompt version.
- Hai trace ID chứng minh hai version/label khác nhau.
- Một ảnh trước/sau khi đổi label hoặc rollback `production`.
- Ghi các ID và đường dẫn ảnh vào `submission/REPORT.md`.

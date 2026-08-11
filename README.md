# Day 13 — Observability cho hệ thống AI

Trong lab 4 giờ này, bạn sẽ biến một API AI chạy được nhưng khó quan sát thành một hệ thống có thể theo dõi, phát hiện sự cố và giải thích nguyên nhân bằng bằng chứng.

Stack quan sát của lab: **Prometheus** thu thập metrics, **Grafana** vẽ dashboard và hiển thị threshold, **Langfuse** lưu trace và prompt version, log JSON nằm trong `data/logs.jsonl`.

## Sau lab, bạn làm được gì?

- Ghi log JSON có cấu trúc và correlation ID xuyên suốt một request.
- Loại bỏ PII trước khi dữ liệu được ghi vào log.
- Instrument counter và histogram Prometheus cho latency, error, token, cost và quality proxy.
- Viết PromQL và dựng dashboard Grafana đọc được.
- Đọc metrics → mở trace → dùng log để chứng minh root cause.
- Thiết kế SLO, alert rule Prometheus và runbook cơ bản.
- Viết báo cáo incident có trace ID hoặc log cụ thể làm bằng chứng.

## Bạn cần hoàn thành

1. Hoàn thiện các khối `TODO` trong `app/` và `config/`.
2. Tạo tối thiểu 10 traces có metadata trên Langfuse.
3. Tạo hai phiên bản prompt cơ bản theo [hướng dẫn prompt versioning](docs/PROMPT_VERSIONING.md), gắn label và chứng minh trace liên kết đúng phiên bản.
4. Dựng dashboard Grafana đủ 6 panel theo [`config/dashboard.yaml`](config/dashboard.yaml), làm theo [hướng dẫn dashboard](docs/DASHBOARD_SETUP.md) và chạy validator thành công.
5. Điều tra challenge chính thức sau khi Lab Coach release `config/challenge.json`.
6. Hoàn thiện `submission/REPORT.md` và lưu bằng chứng trong `submission/evidence/`.

## Luồng làm bài bắt buộc

| Mốc | Làm gì | Tự kiểm tra | Evidence |
|---|---|---|---|
| Setup | Cài Python, chạy `docker compose up -d`, cấu hình Langfuse chung/cloud | `/health` trả `ok: true` và Prometheus target `UP` | ảnh health, ảnh `/targets` và môi trường không lộ key |
| Logging & PII | Hoàn thiện correlation ID, metadata và redaction | `python scripts/validate_logs.py` đạt ít nhất 80/100 | log có correlation ID và log đã che PII |
| Metrics | Hoàn thiện counter và histogram trong `app/metrics.py` | `python scripts/validate_metrics.py` đạt 100/100 | ảnh `/metrics` có đủ series `ai_*` |
| Trace & Prompt Version | Tạo prompt v1/v2, chạy cùng input với hai label | trace có `prompt_name`, `prompt_label`, `prompt_version` | hai trace ID và ảnh đổi label/rollback |
| Dashboard & SLO | Dựng đúng 6 panel Grafana từ PromQL | `python scripts/validate_dashboard.py --alerts` báo hợp lệ | ảnh dashboard có time range, đơn vị, threshold |
| Challenge | Chỉ chạy sau khi Lab Coach release file chính thức | nối được Metrics → Traces → Logs | root cause, fix và preventive measure |
| Nộp bài | Hoàn thiện report, tests và Git | `python -m pytest -q` | repo URL, commit SHA và `submission/` |

Chi tiết thời gian và tiêu chí qua từng mốc nằm ngay trong [CHECKPOINTS.md](CHECKPOINTS.md); cấu trúc nộp bài nằm trong [SUBMISSION.md](SUBMISSION.md).

Trong lab này, Prometheus là nguồn chuẩn của 6 panel dashboard, còn Langfuse dùng cho trace và prompt versioning. Log JSON vẫn là lớp bằng chứng cuối cùng khi điều tra.

## 15 phút đầu

1. Làm theo [SETUP.md](SETUP.md), gồm cả `docker compose up -d`.
2. Chạy API: `uvicorn app.main:app --reload --env-file .env --host 0.0.0.0`.
3. Ở terminal khác, chạy: `python scripts/load_test.py`.
4. Mở `data/logs.jsonl` và ghi lại những trường còn thiếu.
5. Chạy `python scripts/validate_logs.py` để lấy baseline logging.
6. Chạy `python scripts/validate_metrics.py` để lấy baseline metrics.
7. Chạy `python scripts/validate_dashboard.py` để hiểu contract của dashboard.
8. Mở http://localhost:9090/targets và http://localhost:3001 để xác nhận stack đã chạy.

Kết quả đúng ở bước 7 phải có dòng `HỢP LỆ: 6/6 panel`. Lệnh này chỉ kiểm tra contract; ảnh dashboard runtime vẫn phải nộp. Baseline ở bước 6 chỉ khoảng 20/100 vì `app/metrics.py` còn TODO — đó là điểm xuất phát đúng.

## Practice và challenge chính thức

- Practice luôn dùng được: `python scripts/inject_incident.py --scenario rag_slow`.
- Challenge chính thức chỉ chạy sau khi có `config/challenge.json`.
- Khi được release, chạy:

```bash
python scripts/inject_incident.py
python scripts/load_test.py --challenge --concurrency 5
```

Nếu file chưa được release, script sẽ dừng và yêu cầu chờ Lab Coach. Không tự tạo hoặc sửa `config/challenge.json`.

## Cấu trúc repo

```text
app/          API, agent, logging, metrics Prometheus, tracing và PII
config/       log schema, dashboard contract, SLO, Prometheus scrape/alert và challenge được release
data/         dữ liệu practice và log sinh ra khi chạy
docker-compose.yml  stack Prometheus + Grafana của lab
docs/         hướng dẫn, dashboard spec và biểu mẫu bằng chứng
grafana/      provisioning datasource và dashboard khởi tạo
scripts/      load test, inject incident và các validator
tests/        public tests
submission/   báo cáo và evidence phải nộp
```

## Tài liệu cần đọc

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): thành phần, luồng dữ liệu và quyết định thiết kế.
- [CHECKPOINTS.md](CHECKPOINTS.md): tiến độ và đầu ra từng mốc.
- [RULES.md](RULES.md): quy định của bài lab.
- [SUBMISSION.md](SUBMISSION.md): cấu trúc bài nộp.
- [RUBRIC.md](RUBRIC.md): cách chấm tối đa 100 điểm.
- [docs/GUIDE.md](docs/GUIDE.md): gợi ý khi bị kẹt.
- [docs/PROMPT_VERSIONING.md](docs/PROMPT_VERSIONING.md): version, label và rollback prompt.
- [docs/DASHBOARD_SETUP.md](docs/DASHBOARD_SETUP.md): Prometheus, PromQL và cách kiểm tra dashboard Grafana.

## Phân vai nhóm — tối đa 4 vai trò

| Vai trò | Phạm vi chính | Evidence phải bàn giao |
|---|---|---|
| Logging & PII | correlation ID, metadata, JSON log, redaction | log hợp lệ và bằng chứng không lộ PII |
| Metrics & Instrumentation | counter/histogram trong `app/metrics.py`, label, đơn vị | `validate_metrics.py` đạt 100/100 và ảnh `/metrics` |
| Dashboard, SLO & Alert | 6 panel Grafana, PromQL, threshold, SLO, alert rule và runbook | `validate_dashboard.py --alerts` + ảnh dashboard |
| Tracing, Incident & Report | traces, prompt v1/v2, chạy challenge, nối metrics → traces → logs | trace gắn đúng prompt version, root cause và demo cuối |

Một người có thể giữ hai vai trò khi nhóm ít người; không tách thêm vai trò chỉ để chia nhỏ đầu việc.

## Lưu ý

- App dùng fake LLM nên phần practice không cần API key trả phí.
- `/metrics` trả về Prometheus exposition format (text), không phải JSON.
- Prometheus dùng đơn vị **giây** cho latency; log JSON vẫn ghi `latency_ms`. Đừng trộn hai đơn vị trong cùng một panel.
- Langfuse chung/cloud là cách mặc định; Docker Compose local chỉ là lựa chọn dự phòng trong `SETUP.md`.
- Không có Langfuse key, app vẫn chạy bằng prompt local nhưng bạn không có bằng chứng trace/prompt version để lấy trọn điểm.
- `validate_logs.py` và `validate_metrics.py` chỉ là kiểm tra kỹ thuật nhanh, không phải điểm cuối cùng.
- Không commit `.env`, API key, `.venv/` hoặc log chứa dữ liệu nhạy cảm.

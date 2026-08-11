# Chuẩn bị môi trường

## Yêu cầu

- Python 3.11 trở lên.
- Git.
- Docker Desktop để chạy Prometheus, Grafana và Jaeger local.
- Langfuse chỉ là tùy chọn nếu cần managed prompt theo rubric gốc; tracing runtime không cần Langfuse.

## 1. Tạo virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

## 2. Tracing local bằng OpenTelemetry và Jaeger

Không cần API key. Khởi động stack:

```bash
docker compose -f compose.observability.yaml up -d
```

Mặc định app gửi OTLP trace đến `http://127.0.0.1:4318/v1/traces`. Jaeger UI ở `http://127.0.0.1:16686`; logs và trace waterfall được hiển thị ngay tại `http://127.0.0.1:8000/`.

## 3. Tùy chọn: cấu hình Langfuse cho managed prompt

Ưu tiên project dùng chung do Lab Coach cung cấp hoặc Langfuse Cloud. Điền host và key của project vào `.env`:

```dotenv
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_PROMPT_NAME=day13-chat
LANGFUSE_PROMPT_LABEL=production
```

Không commit `.env`. Nếu chưa có key, app dùng local prompt registry với baseline/candidate/production và rollback; OpenTelemetry/Jaeger vẫn ghi đầy đủ version metadata. Chỉ tích hợp managed prompt SaaS của Langfuse là không có.

## 4. Tùy chọn: chạy Langfuse local bằng Docker Compose

Phần này không bắt buộc và không được cộng điểm riêng. Chỉ dùng khi nhóm không truy cập được project chung/cloud và máy có Docker Desktop đủ tài nguyên.

Ở một thư mục nằm ngoài repo bài nộp:

```bash
git clone https://github.com/langfuse/langfuse.git langfuse-local
cd langfuse-local
docker compose up -d
```

Chờ container `langfuse-web` sẵn sàng, sau đó mở `http://localhost:3000`, tạo project và lấy public/secret key. Trong repo lab, đặt:

```dotenv
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

Khi kết thúc buổi lab, dừng stack từ thư mục `langfuse-local`:

```bash
docker compose down
```

Không dùng `docker compose down -v` nếu còn cần dữ liệu trace/prompt trong volume. Xem hướng dẫn cập nhật tại [Langfuse Docker Compose](https://langfuse.com/self-hosting/deployment/docker-compose).

## 5. Kiểm tra cài đặt

Terminal 1:

```bash
uvicorn app.main:app --reload --env-file .env
```

Terminal 2:

```bash
python scripts/load_test.py
python scripts/validate_logs.py
python scripts/validate_dashboard.py
python -m pytest -q
```

API mặc định chạy tại `http://127.0.0.1:8000`; health check ở `/health`, metrics ở `/metrics`.

`/metrics` trả snapshot JSON để debug. Exporter Prometheus nằm ở `/prometheus`; kiến trúc, cách chạy stack và dashboard provisioned nằm trong [báo cáo tổng hợp](submission/REPORT.md).

## Lỗi thường gặp

- `ModuleNotFoundError`: kiểm tra virtual environment đã được activate và chạy lại `pip install -r requirements.txt`.
- Không có `data/logs.jsonl`: bảo đảm API đang chạy trước khi chạy load test.
- Không thấy trace: kiểm tra container Jaeger, cổng 4318 và `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, sau đó restart API.
- Trace ghi `prompt_source=local-fallback`: kiểm tra host/key và prompt name/label trong `.env`.
- Docker local không lên: chạy `docker compose ps`, kiểm tra Docker Desktop và tài nguyên máy; có thể quay về project chung/cloud.
- Challenge chưa chạy: chờ Lab Coach release `config/challenge.json`.

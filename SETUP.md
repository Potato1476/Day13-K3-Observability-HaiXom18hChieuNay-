# Chuẩn bị môi trường

## Yêu cầu

- Python 3.11 trở lên.
- Git.
- Docker Desktop — bắt buộc, dùng để chạy Prometheus và Grafana.
- Tài khoản hoặc project Langfuse do Lab Coach cung cấp.

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

## 2. Chạy Prometheus và Grafana

Stack quan sát nằm ngay trong repo tại [`docker-compose.yml`](docker-compose.yml):

```bash
docker compose up -d
docker compose ps
```

| Thành phần | URL | Ghi chú |
|---|---|---|
| Prometheus | http://localhost:9090 | scrape API mỗi 15 giây |
| Grafana | http://localhost:3001 | đăng nhập `admin` / `admin` |

Grafana map ra cổng 3001 để không đụng cổng 3000 nếu bạn chạy Langfuse local.

Datasource Prometheus và dashboard khởi tạo được provisioning tự động từ thư mục `grafana/`, nên bạn không cần thêm datasource bằng tay. Dashboard `Day 13 AI Observability` nằm trong folder `Day 13` và mới có sẵn 2/6 panel; bốn panel còn lại là phần việc của nhóm.

Dừng stack khi kết thúc buổi lab:

```bash
docker compose down
```

Chỉ dùng `docker compose down -v` khi bạn thực sự muốn xoá toàn bộ dữ liệu metrics đã thu thập.

## 3. Cấu hình Langfuse — mặc định dùng chung/cloud

Prometheus và Grafana lo phần metrics, dashboard và alert. Langfuse vẫn là nơi lưu trace và prompt version.

Ưu tiên project dùng chung do Lab Coach cung cấp hoặc Langfuse Cloud. Điền host và key của project vào `.env`:

```dotenv
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_PROMPT_NAME=day13-chat
LANGFUSE_PROMPT_LABEL=production
```

Không commit `.env`. Nếu chưa có key, app vẫn chạy bằng prompt local; bạn vẫn làm được log, metrics, dashboard và public tests nhưng chưa có evidence trace/prompt version.

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

Khi kết thúc, dừng stack từ thư mục `langfuse-local` bằng `docker compose down`. Không dùng `docker compose down -v` nếu còn cần dữ liệu trace/prompt trong volume. Xem hướng dẫn cập nhật tại [Langfuse Docker Compose](https://langfuse.com/self-hosting/deployment/docker-compose).

## 5. Kiểm tra cài đặt

Terminal 1 — API phải bind `0.0.0.0` thì container Prometheus mới scrape được:

```bash
uvicorn app.main:app --reload --env-file .env --host 0.0.0.0 --port 8000
```

Terminal 2:

```bash
python scripts/load_test.py
python scripts/validate_logs.py
python scripts/validate_metrics.py
python scripts/validate_dashboard.py
python -m pytest -q
```

API mặc định chạy tại `http://127.0.0.1:8000`; health check ở `/health`, metrics ở `/metrics`.

`/metrics` trả về Prometheus exposition format (text), không phải JSON. Kiểm tra nhanh:

```bash
curl http://127.0.0.1:8000/metrics | grep ai_
```

Sau đó mở http://localhost:9090/targets và xác nhận target `day13-lab-api` ở trạng thái `UP`.

Ở baseline, `validate_metrics.py` chỉ đạt khoảng 20/100 vì `app/metrics.py` còn TODO. Đó là điểm xuất phát đúng.

## Lỗi thường gặp

- `ModuleNotFoundError`: kiểm tra virtual environment đã được activate và chạy lại `pip install -r requirements.txt`.
- Không có `data/logs.jsonl`: bảo đảm API đang chạy trước khi chạy load test.
- Prometheus target `DOWN` với lỗi `connection refused`: API đang bind `127.0.0.1`. Chạy lại uvicorn với `--host 0.0.0.0`.
- Prometheus target `DOWN` và không resolve được `host.docker.internal`: kiểm tra `extra_hosts` trong `docker-compose.yml`; trên Linux/WSL2 cần Docker Desktop hoặc `host-gateway`.
- Grafana panel báo `No data`: kiểm tra theo thứ tự TODO trong `app/metrics.py` → `curl /metrics` → Prometheus `/targets` → time range của panel.
- Cổng 9090 hoặc 3001 đã bị dùng: đổi phần mapping bên trái trong `docker-compose.yml` rồi cập nhật `PROMETHEUS_URL`/`GRAFANA_URL` trong `.env`.
- Prometheus không khởi động sau khi bạn sửa alert: chạy `docker compose logs prometheus`; lỗi cú pháp trong `config/alert_rules.yaml` sẽ chặn startup.
- Sửa file trong `config/` nhưng Prometheus không thấy thay đổi: dùng `docker compose restart prometheus`, đừng chỉ gọi `POST /-/reload`. Editor lưu kiểu atomic sẽ đổi inode của file sau mỗi lần lưu.
- Không thấy trace: kiểm tra ba biến `LANGFUSE_*`, sau đó khởi động lại API.
- Trace ghi `prompt_source=local-fallback`: kiểm tra host/key và prompt name/label trong `.env`.
- Challenge chưa chạy: chờ Lab Coach release `config/challenge.json`.

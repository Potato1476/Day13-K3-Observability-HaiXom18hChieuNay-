# Dựng và kiểm tra dashboard Grafana

`config/dashboard.yaml` là contract chấm điểm dùng chung. File này quy định datasource, metric, phép tổng hợp, câu PromQL, đơn vị và threshold cho sáu panel. Grafana chỉ là nơi hiển thị; contract mới là thứ được kiểm tra bằng máy.

Câu lệnh trong `queries` là PromQL thật, chạy được nguyên văn trong Prometheus và Grafana.

## Đường đi của một con số

```text
app/metrics.py  →  GET /metrics  →  Prometheus scrape 15s  →  PromQL  →  panel Grafana
```

Nếu panel trống, hỏng ở một trong bốn chặng đó. Luôn kiểm tra theo đúng thứ tự này.

## Mapping dữ liệu

| Panel | Metric Prometheus | Phép tổng hợp | Đơn vị |
|---|---|---|---|
| Latency | `ai_request_latency_seconds_bucket` | `histogram_quantile` cho P50, P95, P99 | giây |
| Traffic | `ai_requests_total` | `rate()` theo phút và breakdown theo `feature` | request/phút |
| Errors | `ai_requests_total{status="error"}`, `ai_errors_total` | error rate và breakdown theo `error_type` | phần trăm |
| Cost | `ai_cost_usd_total` | `rate()` theo phút và `increase()` toàn cửa sổ | USD |
| Tokens | `ai_tokens_total` | tổng theo `direction` (input/output) | token |
| Quality | `ai_quality_score_sum`, `ai_quality_score_count` | mean = `rate(_sum) / rate(_count)` | điểm 0..1 |

Giữ time range mặc định 60 phút, refresh 30 giây và hiển thị threshold/SLO line. Giá trị chính xác nằm trong `config/dashboard.yaml`; không tự đổi contract chỉ để ảnh dashboard đẹp hơn.

## Ba điều dễ sai với Prometheus

1. **Đơn vị.** Prometheus dùng giây. `latency_ms / 1000` khi observe, và đặt unit của panel là `seconds`. Log JSON vẫn giữ `latency_ms` — hai lớp khác nhau, đừng trộn.
2. **Counter chỉ tăng.** Đừng vẽ thẳng `ai_cost_usd_total`; nó luôn là một đường đi lên. Dùng `rate()` cho tốc độ và `increase()` cho tổng trong một cửa sổ.
3. **Histogram không có sẵn percentile.** `histogram_quantile()` nội suy trong bucket. Percentile không bao giờ vượt quá bucket lớn nhất, nên bucket phải bao được cả trường hợp chậm. Bucket của lab định nghĩa trong `LATENCY_BUCKETS_SECONDS`.

## Cách dựng

1. Hoàn thiện logging/PII và các TODO trong `app/metrics.py`.
2. Chạy API với `--host 0.0.0.0`, rồi `python scripts/load_test.py --concurrency 5` để tạo baseline.
3. Xác nhận series đã có: `python scripts/validate_metrics.py` phải đạt 100/100.
4. Mở http://localhost:9090/targets, target `day13-lab-api` phải `UP`.
5. Thử từng câu PromQL trong http://localhost:9090/graph trước khi đưa vào Grafana. Sai ở đây dễ sửa hơn sai trong panel.
6. Mở Grafana http://localhost:3001, folder `Day 13`, dashboard `Day 13 AI Observability`. Dashboard đã có sẵn panel `traffic` và `latency` làm mẫu; thêm bốn panel còn lại đúng tên, đơn vị và threshold trong contract.
7. Export dashboard (Share → Export → Save to file) và ghi đè `grafana/dashboards/day13-ai-observability.json` để công việc của nhóm nằm trong Git.
8. Chạy validator:

```bash
python scripts/validate_dashboard.py --alerts
```

Validator kiểm tra contract và đối chiếu mọi tên metric trong PromQL với danh sách metric app thực sự export; nó không thể chứng minh biểu đồ trong ảnh dùng đúng dữ liệu. Evidence runtime vẫn bắt buộc.

## Cách kiểm tra runtime

1. Lưu ảnh baseline và giá trị P95/error/cost hiện tại.
2. Bật một incident practice, ví dụ `python scripts/inject_incident.py --scenario rag_slow`.
3. Chạy lại load test với cùng input và concurrency.
4. Chờ ít nhất hai chu kỳ scrape (30 giây) rồi mới đọc panel.
5. Xác nhận panel liên quan thay đổi theo đúng hướng; với `rag_slow`, P95 phải vượt ngưỡng 3 giây.
6. Mở trace chậm trên Langfuse và tìm log có cùng correlation ID.
7. Tắt incident bằng `python scripts/inject_incident.py --scenario rag_slow --disable`.

Ảnh dashboard phải nhìn được tên panel, time range, đơn vị và threshold. Báo cáo phải dẫn lại trace ID hoặc log line dùng để giải thích thay đổi.

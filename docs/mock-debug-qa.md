# Câu hỏi tự kiểm tra

1. Vì sao chỉ nhìn average latency có thể bỏ sót vấn đề?
2. Correlation ID khác trace ID như thế nào?
3. Nếu error rate tăng, bạn mở metric, trace hay log trước? Vì sao?
4. PII cần được scrub trước hay sau khi render JSON?
5. Một alert tốt cần condition, duration, severity và owner như thế nào?
6. Khi cost tăng nhưng traffic không tăng, bạn sẽ kiểm tra những trường nào?
7. Evidence nào đủ để kết luận một span là root cause?
8. Vì sao `validate_logs.py` đạt 100 chưa đồng nghĩa bài lab đạt 100 điểm?
9. Vì sao vẽ thẳng một counter như `ai_cost_usd_total` gần như luôn vô dụng? `rate()` và `increase()` khác nhau ở đâu?
10. `histogram_quantile()` lấy percentile từ đâu, và điều gì xảy ra khi mọi request đều rơi vào bucket cuối?
11. Vì sao Prometheus quy ước dùng giây trong khi log của lab ghi `latency_ms`? Chuyện gì xảy ra nếu trộn hai đơn vị trong một panel?
12. Với scrape interval 15 giây, vì sao `rate(...[1m])` an toàn hơn `rate(...[20s])`?
13. Nếu thêm `user_id` làm label Prometheus thì hỏng chuyện gì? Vì sao lab dùng `feature` và `model` thay vì `user_id`?

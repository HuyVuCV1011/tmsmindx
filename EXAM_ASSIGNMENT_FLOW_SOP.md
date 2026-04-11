# EXAM ASSIGNMENT FLOW SOP

Mục tiêu: Chuẩn hóa luồng kiểm tra chuyên sâu để tránh lệch dữ liệu giữa UI, API, và database.

## 1) Source of truth (nguồn dữ liệu chuẩn)

1. Assignment chính: `chuyen_sau_phancong`
2. Registration gốc: `chuyen_sau_dangky`
3. Bộ đề/câu hỏi: `chuyen_sau_bode`, `chuyen_sau_bode_cauhoi`, `chuyen_sau_cauhoi`
4. Bài nộp: `chuyen_sau_bainop`, `chuyen_sau_bainop_traloi`
5. Bảng đồng bộ điểm legacy: `chuyen_sau_results`

Quy tắc:
- UI không đọc DB trực tiếp, chỉ qua API.
- Điểm hiển thị ưu tiên `chuyen_sau_phancong.score`, fallback `chuyen_sau_results.diem`.
- Mọi endpoint nhận `assignment_id` phải hỗ trợ resolve id legacy (assignment id, registration id, result id).

## 2) API contract chuẩn

1. Danh sách bài thi + điểm: `GET /api/exam-assignments`
- Input bắt buộc: `teacher_code`
- Input mở rộng: `teacher_codes`, `month`, `since`, `before`
- Output cốt lõi: `id`, `assignment_status`, `score`, `score_status`, `explanation_status`, `can_take`

2. Lấy đề thi: `GET /api/exam-assignment-questions?assignment_id=...`
- Validate lịch mở/đóng
- Validate bộ đề active + còn hiệu lực
- Trả assignment + questions

3. Bắt đầu bài thi: `POST /api/exam-submissions`
- Body: `assignment_id`, `teacher_code`
- Không cho bắt đầu lại nếu đã submitted/graded hoặc kết quả đã "Da thi"

4. Nộp bài: `PUT /api/exam-submissions`
- Body: `assignment_id`, `teacher_code`, `answers`
- `answers` bắt buộc là mảng, cho phép mảng rỗng (auto-submit khi hết giờ)
- Server chấm điểm, cập nhật `chuyen_sau_bainop`, `chuyen_sau_phancong`, sync `chuyen_sau_results`

## 3) State machine chuẩn

`assigned` -> `in_progress` -> `graded`

Quy ước:
1. `assigned`: đã phân công nhưng chưa vào làm.
2. `in_progress`: đã start bài thi.
3. `graded`: đã nộp/chấm xong, không được làm lại.
4. `expired`: chỉ dùng cho case hết hạn chưa nộp (nếu có job cập nhật trạng thái).

`can_take = true` khi và chỉ khi:
1. assignment hợp lệ
2. có set hợp lệ + active + có câu hỏi
3. đang trong khung giờ open/close
4. status thuộc `assigned` hoặc `in_progress`
5. không thuộc case giải trình đã duyệt (`explanation_status !== accepted`)

## 4) Chuẩn frontend (trang /user/assignments)

1. Luôn fetch full dữ liệu điểm cho teacher từ `/api/exam-assignments` (không khóa cứng current month ở API call).
2. Card tháng hiện tại là filter hiển thị của frontend, không được giới hạn dữ liệu nguồn.
3. Bộ lọc 6 tháng/all/custom month chỉ xử lý trên dataset đã tải.
4. Link làm bài luôn dùng `assignment id` từ API (`item.id`).

## 5) Checklist release trước khi merge

1. Tab "Kiểm tra" hiển thị bài tháng hiện tại đúng theo open/close.
2. Tab "Điểm kiểm tra" hiển thị đúng 6 tháng gần nhất và all-time.
3. Mở bài thành công với assignment id hợp lệ.
4. Timeout auto-submit thành công kể cả không chọn đáp án nào.
5. Sau khi nộp, assignment chuyển `graded`, `can_take = false`.
6. Điểm được sync vào `chuyen_sau_results` (theo assignment_id hoặc fallback matching).
7. Không còn lỗi diagnostics TypeScript ở các file sửa.

## 6) Runbook debug nhanh

1. Kiểm tra overview DB:
`curl http://localhost:3000/api/database?action=overview`

2. Kiểm tra cấu trúc bảng:
`curl "http://localhost:3000/api/database?action=columns&table=chuyen_sau_phancong"`

3. Preview dữ liệu assignment:
`curl "http://localhost:3000/api/database?action=preview&table=chuyen_sau_phancong&limit=20"`

4. Truy vết 1 assignment cụ thể:
`curl -X POST http://localhost:3000/api/database -H "Content-Type: application/json" -d '{"action":"query","sql":"SELECT cp.id, cp.registration_id, cp.teacher_code, cp.assignment_status, cp.score, cp.score_status, cp.open_at, cp.close_at FROM chuyen_sau_phancong cp WHERE cp.id = <ASSIGNMENT_ID>","secret":"NEXT_PUBLIC_API_SECRET"}'`

5. Truy vết link legacy id:
`curl -X POST http://localhost:3000/api/database -H "Content-Type: application/json" -d '{"action":"query","sql":"SELECT id, assignment_id, registration_id, ma_lms, bo_mon, diem, xu_ly_diem FROM chuyen_sau_results WHERE id = <ANY_INPUT_ID> OR assignment_id = <ANY_INPUT_ID> OR registration_id = <ANY_INPUT_ID> LIMIT 20","secret":"NEXT_PUBLIC_API_SECRET"}'`

## 7) Anti-regression rules

1. Không hardcode filter tháng ở lớp fetch nếu UI có thống kê đa tháng.
2. Không reject submit chỉ vì `answers.length === 0`.
3. Mọi endpoint exam nhận id từ client phải qua hàm resolve id chuẩn.
4. Update status phải đồng bộ giữa `chuyen_sau_bainop` và `chuyen_sau_phancong`.
5. Khi sửa logic điểm, bắt buộc test 4 case: pass, fail, zero-answer timeout, legacy id.

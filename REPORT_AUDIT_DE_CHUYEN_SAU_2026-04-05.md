# Báo cáo Audit Liên kết chức năng Đề Chuyên Sâu

- Ngày audit: 2026-04-05
- Phạm vi màn hình:
  - `/admin/page4/thu-vien-de`
  - `/admin/giaitrinh`
  - `/user/assignments`
  - `/user/giaitrinh`
- Mục tiêu: kiểm tra mức độ liên kết dữ liệu giữa 4 màn, xác định nguồn data thực tế, tìm nguyên nhân lỗi hệ thống và đề xuất hướng chuẩn hóa database.

## 1) Tóm tắt điều hành

Hệ thống hiện **đã có liên kết** giữa luồng tạo đề, phân công bài thi và hiển thị cho giáo viên, nhưng liên kết đang theo kiểu **lai giữa schema mới và schema legacy**. Vì vậy dữ liệu chạy được ở một số bước nhưng dễ lỗi ở các bước phụ thuộc join theo chuỗi hoặc theo tháng/năm.

Các vấn đề lớn nhất hiện tại:

1. Nhiều `teacher_exam_assignments` trỏ vào bộ đề không có câu hỏi.
2. `subject_code` bị phân mảnh nhiều format, làm join không ổn định.
3. Giải trình đang dùng bảng legacy `explanations`, trong khi bảng chuẩn `exam_explanations` chưa được dùng.
4. `teacher_exam_submissions` có dữ liệu chấm điểm, nhưng `teacher_exam_answers` đang trống, thiếu lịch sử trả lời chi tiết.
5. Schema thi chuyên sâu chưa được hợp nhất vào migration chuẩn trong app (`lib/migrations.ts`), đang tách rời bằng script SQL.

---

## 2) Luồng liên kết nghiệp vụ hiện tại

## 2.1 Luồng đề thi và lịch thi

1. Admin tạo bộ đề tại `thu-vien-de`:
   - API: `/api/exam-sets`
   - Bảng: `exam_subject_catalog`, `exam_sets`
2. Admin nhập câu hỏi cho bộ đề:
   - API: `/api/exam-set-questions`
   - Bảng: `exam_set_questions`
3. Admin chọn bộ đề theo tháng:
   - API: `/api/monthly-exam-selections`
   - Bảng: `monthly_exam_selections`
4. Admin tạo lịch sự kiện:
   - API: `/api/event-schedules`
   - Bảng: `event_schedules`

## 2.2 Luồng đăng ký và phân công bài thi

1. Đăng ký thi:
   - API: `/api/exam-registrations`
   - Bảng: `exam_registrations`
2. Phân công bài thi cho giáo viên:
   - API: `/api/exam-assignments`
   - Bảng: `teacher_exam_assignments`
3. Làm bài và nộp bài:
   - API: `/api/exam-assignment-questions`, `/api/exam-submissions`
   - Bảng: `teacher_exam_submissions`, `teacher_exam_answers`

## 2.3 Luồng giải trình

- Admin/User đang thao tác trên API `/api/explanations`
- Bảng thực dùng: `explanations` (legacy)
- Bảng chuẩn mới tồn tại nhưng chưa dùng trong UI/API hiện tại: `exam_explanations`

---

## 3) Nguồn data thực tế đang chạy (snapshot live)

Dựa trên API nội bộ `/api/database?action=overview` và query kiểm tra live DB:

| Bảng | Số dòng |
|---|---:|
| exam_subject_catalog | 23 |
| exam_sets | 32 |
| exam_set_questions | 26 |
| monthly_exam_selections | 13 |
| event_schedules | 9 |
| exam_registrations | 61 |
| teacher_exam_assignments | 61 |
| teacher_exam_submissions | 39 |
| teacher_exam_answers | 0 |
| exam_explanations | 0 |
| explanations (legacy) | 24 |
| chuyen_sau_results | 30 |

Nhận định nhanh:

- Data cốt lõi của thi chuyên sâu đang nằm ở cụm `exam_*` và `teacher_exam_*`.
- Data giải trình vẫn nằm ở bảng legacy `explanations`.

---

## 4) Kết quả kiểm tra liên kết và lỗi dữ liệu

## 4.1 Liên kết assignment -> set -> question bị đứt một phần

- Có nhiều assignment tham chiếu tới set không có câu hỏi (`question_count = 0`).
- Hệ quả:
  - User vào làm bài nhưng không lấy được câu hỏi.
  - Dễ phát sinh trạng thái assignment tồn tại nhưng không thể thi thực tế.

## 4.2 Monthly default set có bản ghi trỏ set rỗng

- Một số dòng `monthly_exam_selections` chọn `selected_set_id` có 0 câu hỏi.
- Dù API có check ở thời điểm lưu mới, dữ liệu cũ/legacy vẫn còn trong DB.

## 4.3 Giải trình đang liên kết theo heuristic, chưa theo khóa chuẩn

- `exam-assignments` đang lấy trạng thái giải trình bằng cách join:
  - `lms_code = teacher_code`
  - `subject = subject_code`
  - cùng tháng/năm
- Cách này không đảm bảo đúng 1-1 với assignment cụ thể.

## 4.4 Mã môn học không chuẩn hóa

Thấy nhiều biến thể `subject_code` cùng ý nghĩa nhưng khác format:

- `[COD] Scratch (S)`
- `SCRATCH`
- `PYTHON_PT_`
- `TEST_CHUY_N_S_U`
- `KI_M_TRA_QUY_TR_NH_K_N_NG_TR_I_NGHI_M`
- `Kiểm tra quy trình & kỹ năng trải nghiệm`

Hệ quả:

- Join sai/thiếu dữ liệu giữa đăng ký, phân công, giải trình.
- Bộ lọc và thống kê theo môn bị lệch.

## 4.5 Chấm bài có điểm nhưng thiếu answer-level history

- `teacher_exam_submissions`: đã có bản ghi `graded`.
- `teacher_exam_answers`: hiện đang 0 dòng.

Hệ quả:

- Không truy vết được giáo viên chọn đáp án nào theo từng câu.
- Khó debug khi phát sinh khiếu nại điểm.

---

## 5) Root cause (nguyên nhân gốc)

1. Hệ thống chuyển tiếp từ dữ liệu cũ sang schema mới nhưng chưa migration dứt điểm.
2. Chuỗi `subject_code` chưa được canonical hóa.
3. Luồng giải trình chưa migrate sang `exam_explanations` theo `assignment_id`.
4. Dữ liệu lịch sử (legacy sets, legacy selections) còn tồn tại mà chưa có quy trình cleanup.
5. Migration trong app chưa chứa đầy đủ schema exam, làm tăng nguy cơ lệch môi trường.

---

## 6) Đề xuất hệ thống lại database (ưu tiên thực thi)

## Giai đoạn 1 - Ổn định chạy thật (High Priority)

1. Chặn assignment vào set rỗng:
   - Trước khi tạo/cập nhật assignment phải verify set có câu hỏi > 0.
2. Dọn dữ liệu `monthly_exam_selections` đang trỏ set rỗng.
3. Tạo job repair assignment cũ đang trỏ set rỗng sang set hợp lệ (cùng subject/exam_type).

## Giai đoạn 2 - Chuẩn hóa dữ liệu (High Priority)

1. Chuẩn hóa `subject_code` về canonical code (1 mã duy nhất/môn).
2. Tạo bảng mapping alias subject (legacy -> canonical).
3. Backfill `exam_registrations`, `teacher_exam_assignments`, `explanations` theo canonical.

## Giai đoạn 3 - Hợp nhất giải trình (High Priority)

1. Backfill từ `explanations` sang `exam_explanations` bằng `assignment_id`.
2. Chuyển API/UI (`/admin/giaitrinh`, `/user/giaitrinh`, tab explanation trong assignments) sang dùng `exam_explanations`.
3. Bật unique và ràng buộc nghiệp vụ chuẩn theo assignment.

## Giai đoạn 4 - Bền vững hạ tầng (Medium Priority)

1. Đưa toàn bộ exam schema vào `lib/migrations.ts` (hoặc chuẩn hóa một cơ chế migration duy nhất).
2. Bổ sung data quality checks định kỳ:
   - assignment trỏ set rỗng
   - subject_code ngoài danh mục canonical
   - submission graded nhưng thiếu answers

---

## 7) Chỉ số giám sát nên theo dõi hằng ngày

1. Tỷ lệ assignment có set rỗng.
2. Tỷ lệ assignment không lấy được câu hỏi.
3. Tỷ lệ giải trình map theo `assignment_id` thành công.
4. Số lượng subject_code ngoài danh mục canonical.
5. Tỷ lệ submission graded có answer-level rows.

---

## 8) Kết luận

- 4 màn đã liên thông ở mức chức năng cơ bản.
- Tuy nhiên DB hiện đang ở trạng thái chuyển tiếp, nên liên kết chưa ổn định và sinh lỗi theo chuỗi dữ liệu.
- Cần ưu tiên 3 việc ngay:
  1. Chặn/repair set rỗng trong assignment.
  2. Chuẩn hóa `subject_code`.
  3. Chuyển giải trình sang `exam_explanations` theo `assignment_id`.

Khi làm xong 3 việc này, độ ổn định luồng chuyên sâu sẽ tăng mạnh và dễ mở rộng lâu dài.

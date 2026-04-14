# API `/api/teachers/info`

> **Route file:** `app/api/teachers/info/route.ts`  
> **Bảo vệ:** `withApiProtection` (same-origin request hoặc `x-api-key` header)  
> **Database:** Bảng `teachers` — PostgreSQL

---

## Mô tả

Endpoint lấy thông tin chi tiết **một giáo viên** từ database, tra cứu theo **mã giáo viên (code)** hoặc **email công ty (work_email)**.

Đây là nguồn dữ liệu giáo viên chính thức trong toàn bộ app — thay thế hoàn toàn API cũ `/api/teachers` từng kéo dữ liệu từ Google Sheets CSV.

---

## HTTP Method

```
GET /api/teachers/info
```

---

## Query Parameters

| Tham số | Kiểu   | Bắt buộc | Mô tả |
|---------|--------|----------|-------|
| `code`  | string | Một trong hai | Mã LMS của giáo viên (ví dụ: `baotc01`) |
| `email` | string | Một trong hai | Email công ty (ví dụ: `baotc01@mindx.net.vn`) |

> Có thể truyền cả hai — API dùng điều kiện `OR` để tìm kiếm.

**Ví dụ:**
```
GET /api/teachers/info?email=baotc01%40mindx.net.vn
GET /api/teachers/info?code=baotc01
```

---

## Response

### Thành công — `200 OK`

```json
{
  "success": true,
  "teacher": {
    "code": "baotc01",
    "full_name": "Nguyễn Văn A",
    "user_name": "baotc01",
    "work_email": "baotc01@mindx.net.vn",
    "personal_email": "nguyenvana@gmail.com",
    "phone_number": "0901 234 567",
    "status_update": "Đang làm",
    "centers": "MindX Cầu Giấy",
    "main_centre": "MindX Cầu Giấy",
    "bu_check": "MindX Cầu Giấy",
    "khoi_final": "K12",
    "khoi_check": "K12",
    "role": "Giáo viên",
    "course_line": "Coding",
    "rank": "GV3",
    "joined_date": "2023-01-15",
    "teacher_point": "85",
    "data_hr_raw": "HR-001",
    "status_check": "Active",
    "status": "Active",
    "check_col": "OK",
    "te_quan_ly": "Trần TE",
    "leader_quan_ly": "Lê Leader",
    "rate_k12_check": "120000",
    "rank_k12_check": "GV3",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2026-04-14T00:00:00Z"
  }
}
```

> **Lưu ý:** Các trường legacy quoted (`"Full name"`, `"Work email"`, v.v.) và `onboarding_snapshot` bị lọc bỏ trước khi trả về.

### Lỗi — `400 Bad Request`

```json
{ "success": false, "error": "Vui lòng truyền code hoặc email" }
```

### Lỗi — `404 Not Found`

```json
{ "success": false, "error": "Không tìm thấy giáo viên trong bảng teachers" }
```

### Lỗi — `500 Internal Server Error`

```json
{ "success": false, "error": "Không thể lấy thông tin giáo viên" }
```

---

## Các trường dữ liệu trả về

| Tên cột DB         | Ý nghĩa                          | Ví dụ |
|--------------------|----------------------------------|-------|
| `code`             | Mã LMS (primary key)             | `baotc01` |
| `full_name`        | Họ và tên đầy đủ                 | `Nguyễn Văn A` |
| `user_name`        | Username hệ thống                | `baotc01` |
| `work_email`       | Email MindX                      | `baotc01@mindx.net.vn` |
| `personal_email`   | Email cá nhân                    | `nguyenvana@gmail.com` |
| `phone_number`     | Số điện thoại                    | `0901234567` |
| `status_update`    | Trạng thái (cập nhật thủ công)   | `Đang làm` |
| `centers`          | Chi nhánh đầu vào (lúc onboard)  | `MindX Cầu Giấy` |
| `main_centre`      | Chi nhánh hiện tại               | `MindX Cầu Giấy` |
| `bu_check`         | BU check (ưu tiên hơn main_centre) | `MindX Cầu Giấy` |
| `khoi_final`       | Khối (phân loại cố định)         | `K12` |
| `khoi_check`       | Khối check (có thể cập nhật)     | `K12` |
| `role`             | Vị trí / chức danh               | `Giáo viên` |
| `course_line`      | Line khóa học                    | `Coding` |
| `rank`             | Rank giáo viên                   | `GV3` |
| `joined_date`      | Ngày bắt đầu làm việc            | `2023-01-15` |
| `teacher_point`    | Điểm giáo viên                   | `85` |
| `data_hr_raw`      | Mã HR gốc                        | `HR-001` |
| `status_check`     | Trạng thái check                 | `Active` |
| `status`           | Trạng thái hệ thống              | `Active` |
| `check_col`        | Cột CHECK nội bộ                 | `OK` |
| `te_quan_ly`       | TE quản lý trực tiếp             | `Trần TE` |
| `leader_quan_ly`   | Leader quản lý                   | `Lê Leader` |
| `rate_k12_check`   | Mức lương K12 (VND)              | `120000` |
| `rank_k12_check`   | Rank K12                         | `GV3` |

---

## Helper utilities (`lib/teacher-db-mapper.ts`)

Các hàm tiện ích để xử lý response:

### `mapTeachersDbRowToTeacher(row)`
Chuyển đổi raw DB row → legacy `Teacher` interface dùng toàn app.

```ts
import { mapTeachersDbRowToTeacher } from '@/lib/teacher-db-mapper'

const dbRow = data.teacher
const teacher = mapTeachersDbRowToTeacher(dbRow)
// → { code, name, emailMindx, branchCurrent, status, ... }
```

### `parseLegacyTeacherFromInfoJson(data)`
Parse toàn bộ JSON response (bao gồm kiểm tra `success` flag).

```ts
import { parseLegacyTeacherFromInfoJson } from '@/lib/teacher-db-mapper'

const result = parseLegacyTeacherFromInfoJson(data)
// → { teacher: Teacher } | null
```

---

## Được sử dụng ở các phần

### Global Context

| File | Cách dùng |
|------|-----------|
| `lib/teacher-context.tsx` | Fetch khi user đăng nhập, lưu vào `TeacherContext` — cung cấp `teacherProfile` cho toàn app qua hook `useTeacher()` |

### Trang giáo viên (User pages)

| Trang | URL | Mục đích |
|-------|-----|----------|
| **Thông tin GV** | `/user/thongtingv` | Hiển thị toàn bộ profile, tìm kiếm theo `code`, dùng SWR với `mapTeachersDbRowToTeacher` |
| **Profile** | `/user/profile` | Hiển thị thông tin cá nhân của GV đang đăng nhập |
| **Assignments** | `/user/assignments` | Lấy `teacher.code` để query bài thi, đăng ký thi |
| **Exam Detail** | `/user/assignments/exam/[id]` | Lấy thông tin GV trước khi xem/làm bài thi |
| **Training** | `/user/training` | Lấy `code` để load module đào tạo của GV |
| **Hoạt động hàng tháng** | `/user/hoat-dong-hang-thang` | Lấy `code` + `bu_check` để load lịch thi & đăng ký chuyên sâu |
| **Giải trình** | `/user/giaitrinh` | Auto-fill form giải trình (tên, mã, campus) từ `teacherProfile` |
| **Giải thích** | `/user/giaithich` | Auto-fill form giải thích chuyên môn |
| **Check datasource** | `/checkdatasource` | Fallback: nếu Sheets không có data, dùng DB để hiển thị profile GV lúc onboard |

### Trang Admin

| Trang | URL | Mục đích |
|-------|-----|----------|
| **Trang admin page1** | `/admin/page1` | Tra cứu GV theo `code`, xem thông tin chi tiết |
| **Tạo deal lương** | `/admin/tao-deal-luong` | Lấy thông tin GV để điền vào form deal lương |

### Components

| Component | Mục đích |
|-----------|----------|
| `components/user/ExplanationSection.tsx` | Auto-fill form giải thích trong sidebar/embed mode, dùng `teacherProfile` từ context |

---

## Logic tra cứu trong DB

```sql
SELECT *
FROM teachers
WHERE
  LOWER(TRIM(code)) = LOWER(TRIM($1))          -- nếu có ?code=
  OR LOWER(TRIM(work_email)) = LOWER(TRIM($2)) -- nếu có ?email=
  OR LOWER(TRIM("Work email")) = LOWER(TRIM($2))
LIMIT 1
```

> Index được tạo sẵn trên `work_email` và `personal_email` để tối ưu tốc độ tra cứu theo email.

---

## Data flow tổng quan

```
Người dùng đăng nhập
        ↓
lib/teacher-context.tsx
  → GET /api/teachers/info?email=...
  → parseLegacyTeacherFromInfoJson()
  → teacherProfile (global context)
        ↓
Tất cả pages đọc từ useTeacher()
  → không cần fetch lại
  → không dùng localStorage (đã loại bỏ)
        ↓
Trang thongtingv / admin: dùng ?code= để
  tra cứu bất kỳ GV nào (không chỉ user hiện tại)
```

---

## Lịch sử thay thế

| Trước (Google Sheets) | Sau (Database) |
|-----------------------|----------------|
| `GET /api/teachers?email=...` | `GET /api/teachers/info?email=...` |
| Kéo CSV từ 4 URL Google Sheets | Query trực tiếp PostgreSQL |
| Cache 5 phút trong memory | Không cache (luôn fresh) |
| Dữ liệu có thể stale | Dữ liệu đồng bộ từ `/checkdatasource` |
| `localStorage.teacher_auto_fill_data` | `useTeacher()` context từ DB |

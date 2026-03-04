# 📊 Báo cáo Tiến độ TMS (Teaching Management System)

> **Ngày báo cáo:** 05/03/2026  
> **Tech Stack:** Next.js (App Router) + TypeScript + SWR + PostgreSQL + Google Apps Script  

---

## ✅ Chức năng ĐÃ THỰC HIỆN

### 1. Hệ thống Xác thực (Authentication)
| Mục | Chi tiết |
|-----|---------|
| Đăng nhập | Firebase Auth via email/password |
| Phân quyền hiện tại | 2 role: `teacher` (user) và `manager` (admin) |
| Bảo vệ route | `ProtectedRoute` component, API protection middleware |
| Session | LocalStorage-based token + user object |

### 2. Thông tin Giáo viên (`thongtingv/page.tsx` — 2253 dòng)
- ✅ Hiển thị hồ sơ cá nhân GV (tên, email, mã, chi nhánh, chương trình, quản lý)
- ✅ Bảng điểm kiểm tra (TestRecord) — theo tháng/năm, đợt, loại bài
- ✅ Trung bình điểm theo tháng (MonthlyAverage chart)
- ✅ Lịch khả dụng (Availability Heatmap — 7 ngày x khung giờ)
- ✅ Thông tin đào tạo nâng cao (TrainingData, lessons, scores)
- ✅ Mentor info (rate, bank, LMS, leader) — tích hợp qua Google Apps Script API
- ✅ Feedback system (gửi feedback)

### 3. Đào tạo Nâng cao (Training)
- ✅ [User] Trang đào tạo nâng cao (`training/page.tsx`) — xem video, bài giảng, điểm
- ✅ [Admin] Quản lý đào tạo nâng cao (`admin/page5`)
- ✅ [Admin] Training Dashboard thống kê (`admin/training-dashboard`)
- ✅ 8+ API routes liên quan: `training`, `training-db`, `training-videos`, `training-video-questions`, `training-assignments`, `training-submissions`, `training-teacher-stats`

### 4. Assignments (Bài tập / Kiểm tra)
- ✅ [User] Làm bài assignment (`assignments/page.tsx`) — quiz, chấm điểm tự động, timer
- ✅ [Admin] Quản lý assignments (`admin/assignments`)
- ✅ [Admin] Quản lý câu hỏi (`admin/assignment-questions`)
- ✅ Upload hình ảnh câu hỏi, upload video, upload thumbnail

### 5. Giải trình Kiểm tra
- ✅ [User] Gửi giải trình (`giaitrinh/page.tsx`) — form gửi, theo dõi status
- ✅ [Admin] Duyệt giải trình (`admin/giaitrinh`) — accept/reject, admin note, gửi email thông báo
- ✅ API: `explanations`, `send-explanation-email` (5 sub-routes)

### 6. Truyền thông (Communications)
- ✅ [User] Xem bài viết, tin tức (`truyenthong/page.tsx`) — PostCard, search, filter, sidebar events
- ✅ [Admin] Dashboard truyền thông — thống kê bài viết, lượt xem, tương tác
- ✅ [Admin] Quản lý bài viết (CRUD, Rich Text Editor)
- ✅ [Admin] Quản lý Slider/Banner
- ✅ 13+ API sub-routes cho truyền thông

### 7. Hạ tầng & Components
- ✅ Sidebar responsive (admin/user menus riêng biệt)
- ✅ Toast notifications, Loading Spinners, Error Boundary
- ✅ RichTextEditor, Modal, ConfirmDialog, Comments system
- ✅ Skeleton loading states cho tất cả components
- ✅ SEO: Not-found page
- ✅ Google Apps Script API integration (mentor info, rawdata)
- ✅ Cloudinary integration (upload media)

---

## 🟡 Chức năng ĐANG THỰC HIỆN

### 1. Hệ thống phân Role: HO / TEGL / TE / LEADER / TC

> **Lưu ý:** Hiện tại hệ thống chỉ có **2 role đơn giản**: `teacher` và `manager`. Đang triển khai hệ thống phân quyền chi tiết theo cấp bậc quản lý.

**Phân cấp quản lý (từ cao → thấp):**

```
HO (Head Office) ← Cao nhất, phân quyền cho các nhóm quản lý dưới
  └── TEGL (Teaching Group Leader)
        └── TE / LEADER / TC
```

| Role | Mô tả | Cấp bậc | Trạng thái |
|------|--------|---------|------------|
| **HO** (Head Office) | Cấp quản lý cao nhất — phân quyền cho nhóm dưới | Cấp 1 | 🟡 Đang triển khai |
| **TEGL** (Teaching Group Leader) | Quản lý nhóm giảng dạy | Cấp 2 | 🟡 Đang triển khai |
| **TE** (Teaching Executive) | Quản lý giảng dạy | Cấp 3 | 🟡 Đang triển khai |
| **LEADER** | Trưởng nhóm | Cấp 3 | 🟡 Đang triển khai |
| **TC** (Teaching Coordinator) | Điều phối giảng dạy | Cấp 3 | 🟡 Đang triển khai |

> Tất cả role đều ở **mức độ quản lý**. HO dùng để phân quyền cho các nhóm quản lý cấp dưới.

### 2. Đăng kí lịch làm bài kiểm tra
- 🟡 Đang phát triển chức năng đăng kí lịch kiểm tra
- 🟡 Đang thiết kế UI để GV chọn ngày/giờ kiểm tra
- 🟡 Đang xây dựng API quản lý slot kiểm tra

### 3. Đăng kí lịch kiểm tra Chuyên sâu
- 🟡 Đang phát triển chức năng đăng kí kiểm tra chuyên sâu
- 🟡 Đang thiết kế phân biệt loại kiểm tra (thường vs chuyên sâu)
- ⚠️ Có file CSV raw data `chuyensau` (~1.7MB) — cần xây dựng UI/flow

### 4. Duyệt lương / Nâng hạ lương / Bonus

**Workflow duyệt:**
```
LEADER / TE / TC  →  TEGL duyệt  →  HO duyệt
   (đề xuất)         (cấp 2)        (cấp cuối)
```

- 🟡 Đang phát triển module quản lý lương
- 🟡 Đang thiết kế workflow duyệt 3 cấp (đề xuất → TEGL → HO)
- 🟡 Đang xây dựng chức năng nâng/hạ lương
- 🟡 Đang xây dựng chức năng quản lý bonus

---

## 📁 Tổng quan Kiến trúc

```
teachingms/
├── app/
│   ├── user/ (Giao diện giáo viên)
│   │   ├── thongtingv/      ✅ Thông tin cá nhân GV
│   │   ├── training/        ✅ Đào tạo nâng cao
│   │   ├── assignments/     ✅ Làm bài tập
│   │   ├── giaitrinh/       ✅ Giải trình kiểm tra
│   │   ├── truyenthong/     ✅ Xem tin tức
│   │   ├── home/            ✅ Trang chủ (calendar)
│   │   └── profile/         ✅ Hồ sơ cá nhân
│   │
│   ├── admin/ (Giao diện quản lý)
│   │   ├── dashboard/       ✅ Dashboard tổng quan
│   │   ├── page1/           ✅ Quản lý thông tin GV
│   │   ├── page2-4/         ⚠️ Placeholder
│   │   ├── page5/           ✅ Quản lý đào tạo nâng cao
│   │   ├── assignments/     ✅ Quản lý assignments
│   │   ├── giaitrinh/       ✅ Duyệt giải trình
│   │   ├── truyenthong/     ✅ Quản lý truyền thông
│   │   └── training-dashboard/ ✅ Thống kê đào tạo
│   │
│   └── api/ (31 API routes)
│       ├── auth/             ✅ Xác thực
│       ├── teachers/         ✅ Dữ liệu giáo viên
│       ├── training*/        ✅ Đào tạo (8 endpoints)
│       ├── truyenthong/      ✅ Truyền thông (13 endpoints)
│       ├── explanations/     ✅ Giải trình
│       └── ...
│
├── components/ (29 components)
└── lib/ (9 utility files)
```

---

## 📈 Tỷ lệ hoàn thành

| Module | Hoàn thành |
|--------|-----------|
| Authentication & Authorization | 40% — có login, đang triển khai phân role HO/TEGL/TE/LEADER/TC |
| Thông tin GV | 90% |
| Đào tạo nâng cao | 85% |
| Assignments | 80% |
| Giải trình kiểm tra | 90% |
| Truyền thông | 85% |
| **Đăng kí lịch kiểm tra** | **🟡 Đang triển khai** |
| **Đăng kí kiểm tra chuyên sâu** | **🟡 Đang triển khai** |
| **Duyệt lương / Nâng hạ lương / Bonus** | **🟡 Đang triển khai** |
| **Hệ thống phân Role HO/TEGL/TE/LEADER/TC** | **🟡 Đang triển khai** |

> **Tổng thể ước tính: ~55%** — Các module core đã khá hoàn chỉnh, 4 chức năng quan trọng đang được triển khai.

---

## 🗺️ Roadmap 4–6 tuần tiếp theo

> **Bắt đầu:** 05/03/2026 → **Dự kiến hoàn thành:** giữa tháng 04/2026

### 📅 Tuần 1–2 (05/03 – 18/03): Hệ thống phân Role

| Ngày | Công việc | Output |
|------|-----------|--------|
| T1-T2 | Thiết kế DB schema cho role hierarchy (HO → TEGL → TE/LEADER/TC) | Migration file, ERD |
| T3 | Cập nhật `auth-context.tsx` — thêm role mới, middleware phân quyền | Updated auth system |
| T4 | Xây dựng API `/api/roles` — CRUD, gán role, phân quyền theo cấp | API endpoints |
| T5-T6 | UI Admin: Trang quản lý phân quyền (HO gán quyền cho TEGL, TEGL gán cho TE/LEADER/TC) | Admin role management page |
| T7 | Cập nhật Sidebar, ProtectedRoute theo role mới | Role-based navigation |

**Milestone:** ✅ Đăng nhập → hệ thống nhận diện role → hiển thị menu/chức năng theo cấp bậc

---

### 📅 Tuần 2–3 (16/03 – 25/03): Đăng kí lịch làm bài kiểm tra

| Ngày | Công việc | Output |
|------|-----------|--------|
| T1 | Thiết kế DB: bảng `exam_slots`, `exam_registrations` | Migration file |
| T2 | API `/api/exam-schedule` — tạo slot, danh sách slot, đăng kí | API endpoints |
| T3-T4 | UI User: Trang đăng kí lịch kiểm tra (calendar picker, chọn slot, xác nhận) | User registration page |
| T5 | UI Admin/TEGL: Trang tạo & quản lý slot kiểm tra | Admin slot management |
| T6 | Thông báo email xác nhận đăng kí | Email integration |

**Milestone:** ✅ GV đăng kí lịch kiểm tra → Admin/TEGL tạo slot → GV chọn slot → xác nhận email

---

### 📅 Tuần 3–4 (24/03 – 04/04): Đăng kí lịch kiểm tra Chuyên sâu

| Ngày | Công việc | Output |
|------|-----------|--------|
| T1 | Mở rộng DB: phân loại kiểm tra (thường / chuyên sâu), điều kiện đăng kí | Updated schema |
| T2 | Import & xử lý dữ liệu CSV `chuyensau` (~1.7MB) vào hệ thống | Data pipeline |
| T3-T4 | UI User: Trang đăng kí kiểm tra chuyên sâu (điều kiện, môn chuyên sâu, lịch) | Specialized exam registration |
| T5 | UI Admin: Quản lý kết quả kiểm tra chuyên sâu, thống kê | Admin dashboard |
| T6 | Tích hợp kết quả chuyên sâu vào `thongtingv` (hồ sơ GV) | Profile integration |

**Milestone:** ✅ GV đăng kí kiểm tra chuyên sâu → làm bài → kết quả hiển thị trong hồ sơ

---

### 📅 Tuần 4–6 (01/04 – 16/04): Duyệt lương / Nâng hạ lương / Bonus

**Workflow:** `LEADER/TE/TC đề xuất → TEGL duyệt → HO duyệt`

| Ngày | Công việc | Output |
|------|-----------|--------|
| T1-T2 | Thiết kế DB: `salary_records`, `salary_adjustments`, `bonuses`, `salary_approvals` (3 cấp duyệt) | Migration file, ERD |
| T3-T4 | API `/api/salary` — đề xuất, duyệt TEGL, duyệt HO, bonus | API endpoints |
| T5-T6 | UI LEADER/TE/TC: Đề xuất nâng/hạ lương, thêm bonus cho GV | Proposal form |
| T7-T8 | UI TEGL: Duyệt cấp 2 — approve/reject đề xuất từ LEADER/TE/TC | TEGL approval page |
| T9 | UI HO: Duyệt cấp cuối — approve/reject, lịch sử thay đổi | HO final approval |
| T10 | UI User: GV xem lương, lịch sử nâng/hạ, bonus + Báo cáo tổng hợp export Excel | Salary info + Report |

**Milestone:** ✅ LEADER/TE/TC đề xuất → TEGL duyệt → HO duyệt cuối → GV xem lương

---

### 📊 Tổng hợp Roadmap

```
Tuần 1 ████████░░░░░░░░░░░░░░░░  Phân Role (HO/TEGL/TE/LEADER/TC)
Tuần 2 ████████████░░░░░░░░░░░░  Phân Role + Đăng kí lịch KT
Tuần 3 ░░░░░░░░████████░░░░░░░░  Đăng kí lịch KT + KT Chuyên sâu
Tuần 4 ░░░░░░░░░░░░████████░░░░  KT Chuyên sâu + Duyệt lương
Tuần 5 ░░░░░░░░░░░░░░░░████████  Duyệt lương / Nâng hạ / Bonus
Tuần 6 ░░░░░░░░░░░░░░░░░░██████  Bonus + Testing + Polish
```

> **Sau 6 tuần:** Dự kiến hệ thống đạt **~90% hoàn thành**, sẵn sàng UAT và go-live.

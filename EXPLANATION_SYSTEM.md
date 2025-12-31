# Hệ Thống Giải Trình Không Tham Gia Kiểm Tra

## 📋 Tổng quan

Hệ thống cho phép giáo viên gửi giải trình không tham gia kiểm tra và quản lý duyệt các giải trình đó.

## 🗂️ Cấu trúc files đã tạo

### 1. Database
- `scripts/create_explanations_table.sql` - Script tạo bảng trong PostgreSQL

### 2. API Routes
- `app/api/explanations/route.ts` - CRUD operations cho giải trình
  - GET: Lấy danh sách (có filter theo email và status)
  - POST: Tạo giải trình mới
  - PATCH: Admin cập nhật trạng thái
- `app/api/send-explanation-email/route.ts` - Gửi email thông báo

### 3. Frontend Pages
- `app/user/giaithich/page.tsx` - Giao diện cho giáo viên
- `app/admin/giaithich/page.tsx` - Giao diện cho quản lý

### 4. Library
- `lib/db.ts` - Connection pool database (đã tạo trước đó)

## 🚀 Hướng dẫn cài đặt

### Bước 1: Cài đặt package (nếu chưa có)

Package `nodemailer` đã có trong package.json, chỉ cần chạy:

```bash
npm install
```

### Bước 2: Cấu hình Environment Variables

Thêm vào file `.env.local`:

```env
# Gmail Configuration (đã có)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# Database (đã có)
DB_HOST=your-database-host
DB_PORT=your-database-port
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password

# Base URL (thêm mới nếu chưa có)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Bước 3: Tạo bảng trong Database

Chạy SQL script để tạo bảng:

```bash
# Connect to database
psql -h pg-146bfe89-bwc-67c8.h.aivencloud.com -p 10058 -U avnadmin -d defaultdb

# Sau đó copy và paste nội dung từ file:
# scripts/create_explanations_table.sql
```

Hoặc sử dụng GUI tool như pgAdmin, DBeaver để chạy script.

### Bước 4: Cấu hình Gmail App Password

1. Đi đến Google Account: https://myaccount.google.com/
2. Security → 2-Step Verification (bật nếu chưa có)
3. App passwords → Tạo password mới
4. Copy password và paste vào `GMAIL_APP_PASSWORD` trong `.env.local`

## 📧 Luồng gửi email

### 1. Khi giáo viên tạo giải trình mới:
- **To:** academick12@mindx.com.vn
- **CC:** Email giáo viên
- **Subject:** [MindX | Teaching] V/v không tham gia kiểm tra
- **Nội dung:** Thông tin đầy đủ về giải trình

### 2. Khi admin chấp nhận giải trình:
- **To:** Email giáo viên
- **CC:** academick12@mindx.com.vn
- **Subject:** [MindX | Teaching] Thông báo: Giải trình được chấp nhận
- **Nội dung:** Thông báo chấp nhận + ghi chú từ admin (nếu có)

### 3. Khi admin từ chối giải trình:
- **To:** Email giáo viên
- **CC:** academick12@mindx.com.vn
- **Subject:** [MindX | Teaching] Thông báo: Giải trình không được chấp nhận
- **Nội dung:** Thông báo từ chối + lý do từ admin (nếu có)

## 🎯 Chức năng

### Giao diện User (Giáo viên)
**URL:** `/user/giaithich`

✅ Tạo giải trình mới với form:
- Họ và tên
- Mã LMS
- Email (tự động điền từ user đang login)
- Cơ sở trực thuộc
- Bộ môn
- Ngày kiểm tra
- Lý do không tham gia

✅ Xem danh sách giải trình của mình
✅ Xem trạng thái: Đang chờ, Đã chấp nhận, Đã từ chối
✅ Xem ghi chú từ quản lý

### Giao diện Admin (Quản lý)
**URL:** `/admin/giaithich`

✅ Xem tất cả giải trình của tất cả giáo viên
✅ Lọc theo trạng thái (All, Pending, Accepted, Rejected)
✅ Xem chi tiết giải trình
✅ Chấp nhận hoặc Từ chối giải trình
✅ Thêm ghi chú khi duyệt
✅ Tự động gửi email thông báo cho giáo viên

## 🗄️ Database Schema

```sql
CREATE TABLE explanations (
  id SERIAL PRIMARY KEY,
  teacher_name VARCHAR(255) NOT NULL,
  lms_code VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  campus VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  test_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected
  admin_note TEXT,
  admin_email VARCHAR(255),
  admin_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 API Endpoints

### GET /api/explanations
Lấy danh sách giải trình

**Query params:**
- `email` (optional) - Lọc theo email giáo viên
- `status` (optional) - Lọc theo trạng thái (pending, accepted, rejected)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

### POST /api/explanations
Tạo giải trình mới

**Body:**
```json
{
  "teacher_name": "Nguyễn Văn A",
  "lms_code": "GV001",
  "email": "nguyenvana@mindx.net.vn",
  "campus": "Hà Nội",
  "subject": "Web Development",
  "test_date": "2025-01-15",
  "reason": "Lý do không tham gia..."
}
```

### PATCH /api/explanations
Admin cập nhật trạng thái

**Body:**
```json
{
  "id": 1,
  "status": "accepted",
  "admin_note": "Đồng ý cho phép",
  "admin_email": "admin@mindx.com.vn",
  "admin_name": "Admin Name"
}
```

### POST /api/send-explanation-email
Gửi email (tự động được gọi từ các API trên)

**Body:**
```json
{
  "type": "new", // hoặc "accepted", "rejected"
  "explanation": {...}
}
```

## 📱 Screenshots & UI

### User Interface
- Form tạo giải trình với validation đầy đủ
- Bảng hiển thị danh sách với filter status
- Badge màu sắc theo trạng thái
- Collapse/Expand để xem chi tiết

### Admin Interface
- Tabs filter: All, Pending, Accepted, Rejected với số lượng
- Modal popup để xem chi tiết và duyệt
- Nút Accept/Reject với confirmation
- Textarea để thêm ghi chú

## ⚠️ Lưu ý

1. **Email Configuration:** Đảm bảo Gmail App Password được cấu hình đúng
2. **Database:** Chạy script SQL trước khi sử dụng
3. **Authentication:** Cần có user context (email) để tạo giải trình
4. **Error Handling:** Nếu gửi email thất bại, giải trình vẫn được lưu vào DB

## 🔐 Bảo mật

- Sử dụng environment variables cho thông tin nhạy cảm
- Validate input ở cả client và server
- SQL injection prevention với parameterized queries
- Email chỉ gửi đến domain @mindx.com.vn

## 🐛 Troubleshooting

### Email không gửi được
- Kiểm tra `GMAIL_USER` và `GMAIL_APP_PASSWORD` trong `.env.local`
- Đảm bảo 2-Step Verification đã bật
- Kiểm tra App Password còn hiệu lực

### Database connection error
- Kiểm tra thông tin kết nối trong `.env.local`
- Đảm bảo bảng `explanations` đã được tạo
- Kiểm tra network/firewall

### UI không hiển thị
- Kiểm tra `useAuth()` context đã được setup
- Xem console browser để check lỗi API
- Đảm bảo user đã login

## 🎉 Hoàn thành!

Hệ thống giải trình đã sẵn sàng sử dụng. Giáo viên có thể tạo giải trình và admin có thể duyệt ngay lập tức!

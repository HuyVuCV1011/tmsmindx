# Hướng dẫn cài đặt tính năng Profile Giáo viên

## 1. Chạy Migration Database

Trước khi sử dụng tính năng profile, bạn cần tạo bảng `teacher_certificates` trong database:

### Cách 1: Sử dụng psql (PostgreSQL CLI)

```bash
psql -h your_host -U your_username -d your_database -f scripts/create_teacher_certificates_table.sql
```

### Cách 2: Sử dụng Database GUI (pgAdmin, DBeaver, etc.)

1. Mở file `scripts/create_teacher_certificates_table.sql`
2. Copy nội dung
3. Paste và execute trong SQL query tool của database GUI

### Cách 3: Sử dụng Node.js script

Tạo file `scripts/run-migration.js`:

```javascript
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigration() {
  try {
    const sqlFile = fs.readFileSync(
      path.join(__dirname, "create_teacher_certificates_table.sql"),
      "utf8",
    );

    await pool.query(sqlFile);
    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
```

Chạy:

```bash
node scripts/run-migration.js
```

## 2. Cấu hình Cloudinary

Đảm bảo file `.env` có các biến sau:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 3. Sử dụng tính năng

### Truy cập trang Profile

- URL: `/user/profile`
- Hoặc click vào "Hồ sơ giáo viên" trong sidebar

### Tính năng chính

✅ **Xem thông tin cá nhân**: Avatar, tên, email, mã giáo viên  
✅ **Quản lý chứng chỉ**: Xem danh sách tất cả chứng chỉ đã tải lên  
✅ **Thêm chứng chỉ mới**:

- Nhập tên chứng chỉ
- Chọn loại (Ngoại ngữ, Công nghệ, Sư phạm, Khác)
- Nhập ngày cấp và ngày hết hạn (optional)
- Thêm mô tả (optional)
- Tải lên ảnh hoặc PDF (tối đa 10MB)

✅ **Xóa chứng chỉ**: Click nút xóa trên mỗi chứng chỉ  
✅ **Xem chi tiết**: Click vào ảnh chứng chỉ để xem full size

## 4. API Endpoints

### GET `/api/teacher-certificates`

Lấy danh sách chứng chỉ của giáo viên

Query params:

- `email` (required): Email của giáo viên

### POST `/api/teacher-certificates`

Thêm chứng chỉ mới

Body:

```json
{
  "teacher_email": "teacher@example.com",
  "certificate_name": "IELTS 7.5",
  "certificate_url": "https://cloudinary.com/...",
  "certificate_type": "Language",
  "issue_date": "2024-01-15",
  "expiry_date": "2026-01-15",
  "description": "IELTS Academic",
  "cloudinary_public_id": "public_id"
}
```

### DELETE `/api/teacher-certificates`

Xóa chứng chỉ

Query params:

- `id` (required): ID của chứng chỉ
- `email` (required): Email của giáo viên (để verify ownership)

## 5. Troubleshooting

### Lỗi: "Table doesn't exist"

➡️ Chạy lại migration script

### Lỗi: "Failed to upload"

➡️ Kiểm tra Cloudinary credentials trong `.env`

### Lỗi: "Unauthorized"

➡️ Đảm bảo đã đăng nhập và có token hợp lệ

## 6. Cấu trúc Database

```sql
Table: teacher_certificates
- id (SERIAL PRIMARY KEY)
- teacher_email (VARCHAR(255)) - Email giáo viên
- certificate_name (VARCHAR(500)) - Tên chứng chỉ
- certificate_url (TEXT) - URL ảnh/PDF
- certificate_type (VARCHAR(100)) - Loại chứng chỉ
- issue_date (DATE) - Ngày cấp
- expiry_date (DATE) - Ngày hết hạn
- description (TEXT) - Mô tả
- cloudinary_public_id (VARCHAR(255)) - ID Cloudinary
- created_at (TIMESTAMP) - Ngày tạo
- updated_at (TIMESTAMP) - Ngày cập nhật
```

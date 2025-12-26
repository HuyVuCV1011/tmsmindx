# Hướng dẫn cấu hình Admin Check

## Bước 1: Deploy Google Apps Script

1. Mở Google Sheets chứa dữ liệu giáo viên
2. Mở **Extensions > Apps Script**
3. Tạo file mới tên `adminCheck.gs`
4. Copy nội dung từ file `ApiAppScript/auth/mã.gs`
5. Chạy function `setupAdminSheet()` một lần để tạo sheet Admins

## Bước 2: Setup Sheet Admins

Sheet **Admins** sẽ có cấu trúc:
```
| Email                    | Name       | Role        | Added Date          |
|--------------------------|------------|-------------|---------------------|
| admin@mindx.com.vn       | Admin User | Super Admin | 2025-12-27T10:00:00 |
| manager1@mindx.com.vn    | Manager 1  | Admin       | 2025-12-27T10:00:00 |
```

**Thêm email admin vào cột A** (từ row 2 trở đi)

## Bước 3: Deploy Web App

1. Trong Apps Script, click **Deploy > New deployment**
2. Chọn type: **Web app**
3. Cấu hình:
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
4. Click **Deploy**
5. Copy **Web app URL**

## Bước 4: Cập nhật Environment Variables

Tạo file `.env.local` hoặc thêm vào file hiện có:

```env
NEXT_PUBLIC_ADMIN_CHECK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

Thay `YOUR_SCRIPT_ID` bằng URL từ bước 3.

## Bước 5: Test

1. Restart Next.js server: `npm run dev`
2. Đăng nhập với role **Manager**
3. Nếu email trong sheet Admins → vào `/admin/dashboard`
4. Nếu email không có trong Admins → vào `/user/thongtingv`

## Cách hoạt động

```
User login với Manager role
         ↓
Firebase Authentication
         ↓
Check email trong Google Sheet (Admins)
         ↓
    ┌────────┴────────┐
    ↓                 ↓
Is Admin?          Not Admin?
    ↓                 ↓
/admin/dashboard   /user/thongtingv
```

## Sheet Logs

Tất cả việc check admin sẽ được log vào sheet **AuthLogs**:
```
| Timestamp               | Email              | Status | Action                  |
|-------------------------|--------------------|---------|-----------------------|
| 2025-12-27T10:30:00     | admin@mindx.com.vn | ADMIN   | Check admin permission |
| 2025-12-27T10:31:00     | user@mindx.com.vn  | USER    | Check admin permission |
```

## Security Notes

- Sheet Admins nên được bảo vệ (Protected range)
- Chỉ admin Google Sheets mới có quyền edit
- Apps Script execute as owner, bảo mật thông tin
- Web app URL nên được giữ bí mật (không commit vào git)

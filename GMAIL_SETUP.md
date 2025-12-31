# Hướng Dẫn Cấu Hình Gmail Để Gửi Email

## Vấn đề
Lỗi: `Missing credentials for "PLAIN"` xảy ra khi thiếu cấu hình Gmail.

## Giải pháp

### Bước 1: Lấy Gmail App Password

1. Truy cập: https://myaccount.google.com/security
2. Tìm và bật **2-Step Verification** (nếu chưa có)
3. Sau khi bật 2FA, tìm **App passwords**
4. Chọn **Mail** và **Other** (đặt tên: MindX Teaching System)
5. Click **Generate**
6. Copy 16 ký tự password (dạng: `abcd efgh ijkl mnop`)

### Bước 2: Cập nhật .env.local

Mở file `.env.local` và thêm:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

**Lưu ý:** Loại bỏ dấu cách trong App Password

### Bước 3: Restart Development Server

```bash
# Dừng server (Ctrl+C)
# Khởi động lại
npm run dev
```

## Test Email

Sau khi cấu hình xong:

1. Vào `/user/giaithich`
2. Tạo giải thích mới
3. Kiểm tra email tại `academick12@mindx.com.vn`

## Nếu không muốn gửi email (Development)

Hệ thống đã được cập nhật để hoạt động ngay cả khi không có Gmail credentials:
- Giải thích vẫn được lưu vào database
- Console sẽ log thông tin thay vì gửi email
- Không có lỗi fatal

## Kiểm tra Log

Khi email được gửi hoặc bị skip:
```
⚠️ Gmail credentials not configured
Email type: new
Explanation details: {...}
```

Hoặc:
```
✅ Email sent successfully
```

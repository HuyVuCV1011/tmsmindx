# ❌ VẤN ĐỀ: LUỒNG MAIL GIẢI TRÌNH KHÔNG HOẠT ĐỘNG

## 🔍 Nguyên Nhân
**Thiếu cấu hình Gmail credentials** trong file `.env.local`

## ✅ Giải Pháp Nhanh

### 1. Tạo Gmail App Password
- Vào: https://myaccount.google.com/apppasswords
- Tạo password cho app "Mail"
- Copy mã 16 ký tự

### 2. Cấu hình file .env.local
```bash
# Tạo file .env.local
GMAIL_USER=baotc@mindx.com.vn
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### 3. Restart Server
```bash
npm run dev
```

## 📖 Chi Tiết
Xem file [EMAIL_CONFIGURATION_GUIDE.md](./EMAIL_CONFIGURATION_GUIDE.md) để biết hướng dẫn chi tiết.

## 🎯 Kết Quả
- ✅ Email gửi khi giáo viên tạo giải trình
- ✅ Email gửi khi admin accept/reject giải trình
- ✅ Email CC cho cả giáo viên và baotc@mindx.com.vn

---
**Quick Fix**: Ngày 2026-02-09

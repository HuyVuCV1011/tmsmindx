# 📧 Hướng Dẫn Cấu Hình Email Giải Trình

## ❌ Vấn Đề Hiện Tại

Luồng mail giải trình **KHÔNG HOẠT ĐỘNG** vì thiếu cấu hình Gmail credentials trong file `.env.local`.

### Hiện tượng:
- ✅ Giáo viên tạo giải trình thành công
- ✅ Admin có thể accept/reject giải trình
- ❌ **Không có email nào được gửi**
- ⚠️ Console hiển thị warning: `Gmail credentials not configured`

## 🛠️ Cách Khắc Phục

### Bước 1: Tạo Gmail App Password

1. **Truy cập Google Account**:
   - Vào https://myaccount.google.com/security

2. **Bật 2-Step Verification** (nếu chưa có):
   - Trong mục "Signing in to Google"
   - Chọn "2-Step Verification" → Follow hướng dẫn

3. **Tạo App Password**:
   - Vào https://myaccount.google.com/apppasswords
   - Hoặc: Security → 2-Step Verification → App passwords
   - Chọn app: **Mail**
   - Chọn device: **Windows Computer** (hoặc bất kỳ)
   - Click **Generate**
   - Copy mã **16 ký tự** (dạng: `xxxx xxxx xxxx xxxx`)

### Bước 2: Cấu Hình File .env.local

1. **Tạo file `.env.local`** trong thư mục root (nếu chưa có):
```bash
copy .env.example .env.local
```

2. **Thêm Gmail credentials**:
```env
# Gmail Configuration
GMAIL_USER=baotc@mindx.com.vn
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```

> ⚠️ **Lưu ý**: 
> - Sử dụng email chính thức của MindX (baotc@mindx.com.vn)
> - App Password **KHÔNG PHẢI** mật khẩu Gmail thường
> - Bỏ dấu cách trong App Password (hoặc giữ nguyên, nodemailer tự xử lý)

3. **Restart Dev Server**:
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Bước 3: Kiểm Tra Hoạt Động

1. **Tạo giải trình mới**:
   - Đăng nhập với role Giáo viên
   - Tạo một giải trình test
   - ✅ Email được gửi đến `baotc@mindx.com.vn` và CC giáo viên

2. **Accept/Reject giải trình**:
   - Đăng nhập với role Admin
   - Vào trang Giải Trình
   - Accept hoặc Reject một giải trình
   - ✅ Email thông báo được gửi đến giáo viên và CC `baotc@mindx.com.vn`

## 📨 Luồng Email

### 1️⃣ Email "New Explanation" (Giáo viên tạo giải trình)
- **To**: `baotc@mindx.com.vn`
- **CC**: Email giáo viên
- **Subject**: `[MindX | Teaching] V/v không tham gia kiểm tra`
- **Template**: `new-explanation.html`

### 2️⃣ Email "Accepted Explanation" (Admin chấp nhận)
- **To**: Email giáo viên
- **CC**: `baotc@mindx.com.vn`
- **Subject**: `[MindX | Teaching] Thông báo: Giải trình được chấp nhận`
- **Template**: `accepted-explanation.html`

### 3️⃣ Email "Rejected Explanation" (Admin từ chối)
- **To**: Email giáo viên
- **CC**: `baotc@mindx.com.vn`
- **Subject**: `[MindX | Teaching] Thông báo: Giải trình không được chấp nhận`
- **Template**: `rejected-explanation.html`

## 🔍 Debug & Troubleshooting

### Kiểm tra console logs:
```javascript
// Nếu thiếu credentials:
⚠️ Gmail credentials not configured. Email functionality will be disabled.
⚠️ Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local
⚠️ Email not sent - Gmail credentials not configured

// Nếu có credentials nhưng gửi thất bại:
❌ Error sending email: [Error details]
```

### Các vấn đề thường gặp:

#### 1. "Invalid credentials"
- ✅ Kiểm tra lại email có đúng không
- ✅ App Password có đúng 16 ký tự không
- ✅ Đã bật 2-Step Verification chưa

#### 2. "Less secure app access"
- ✅ Sử dụng **App Password**, KHÔNG dùng mật khẩu Gmail thường
- ✅ Không cần bật "Less secure app access"

#### 3. Email vào Spam
- ✅ Kiểm tra thư mục Spam
- ✅ Đánh dấu "Not spam" và add sender vào Contacts

#### 4. Email không gửi nhưng không báo lỗi
- ✅ Kiểm tra file `.env.local` có được load không (restart server)
- ✅ Kiểm tra `process.env.GMAIL_USER` trong console:
```javascript
console.log('Gmail user:', process.env.GMAIL_USER);
```

## 🔐 Bảo Mật

### ⚠️ QUAN TRỌNG:
- **KHÔNG** commit file `.env.local` lên Git
- `.env.local` đã được thêm vào `.gitignore`
- Chỉ share App Password qua kênh bảo mật (1Password, LastPass, v.v.)
- Revoke App Password ngay nếu bị lộ

### Revoke App Password:
1. Vào https://myaccount.google.com/apppasswords
2. Tìm app password đã tạo
3. Click **Remove** → Confirm
4. Tạo mới nếu cần

## 📝 Checklist

- [ ] Đã bật 2-Step Verification trên Google Account
- [ ] Đã tạo App Password cho Mail
- [ ] Đã tạo file `.env.local` trong root folder
- [ ] Đã thêm `GMAIL_USER` và `GMAIL_APP_PASSWORD`
- [ ] Đã restart dev server
- [ ] Đã test tạo giải trình → nhận email
- [ ] Đã test accept/reject → giáo viên nhận email

## 🚀 Production Deployment

Khi deploy lên **Vercel/Production**:

1. Vào Vercel Dashboard → Project Settings → Environment Variables
2. Thêm 2 biến:
   - `GMAIL_USER` = `baotc@mindx.com.vn`
   - `GMAIL_APP_PASSWORD` = `your-app-password`
3. Redeploy project

## 📞 Hỗ Trợ

Nếu vẫn gặp vấn đề, liên hệ:
- Teaching Team
- IT Support

---

**Last Updated**: 2026-02-09

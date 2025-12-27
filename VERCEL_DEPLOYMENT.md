# Hướng dẫn Deploy lên Vercel

## Bước 1: Chuẩn bị Environment Variables

Truy cập **Vercel Dashboard** → **Project Settings** → **Environment Variables** và thêm các biến sau:

### Bắt buộc:

```
NEXT_PUBLIC_APP_URL=https://tmsmindx.vercel.app
NEXT_PUBLIC_API_SECRET=mindx-teaching-internal-2025
```

### Google Sheets URLs:

```
NEXT_PUBLIC_TEACHER_PROFILE_CSV_URL=<your_csv_url>
NEXT_PUBLIC_TEACHER_EXPERTISE_CSV_URL=<your_csv_url>
NEXT_PUBLIC_TEACHER_EXPERIENCE_CSV_URL=<your_csv_url>
NEXT_PUBLIC_TRAINING_CSV_URL=<your_csv_url>
NEXT_PUBLIC_AVAILABILITY_CSV_URL=<your_csv_url>
```

### Admin & External URLs:

```
NEXT_PUBLIC_ADMIN_CHECK_URL=<your_admin_check_url>
NEXT_PUBLIC_TEST_SCHEDULE_URL=<your_schedule_url>
NEXT_PUBLIC_TEST_REGISTER_FORM_URL=<your_form_url>
NEXT_PUBLIC_TEST_REGISTER_ADDITIONAL_FORM_URL=<your_form_url>
NEXT_PUBLIC_FEEDBACK_SHEET_URL=<your_feedback_url>
```

## Bước 2: Deploy

1. Push code lên GitHub
2. Import project vào Vercel
3. Vercel sẽ tự động detect Next.js và deploy

## Bước 3: Kiểm tra

Sau khi deploy xong, kiểm tra:

- ✅ Đăng nhập thành công
- ✅ Tìm kiếm giáo viên hoạt động
- ✅ Không có lỗi 403 Forbidden

## Lưu ý quan trọng:

### 1. CORS & API Protection

File `lib/api-protection.ts` đã được cấu hình để:
- Cho phép requests từ `https://tmsmindx.vercel.app`
- Cho phép same-origin requests (tự động detect domain hiện tại)
- Yêu cầu `x-api-key` hoặc Firebase authentication token

### 2. Custom Domain

Nếu sử dụng custom domain, thêm domain đó vào `ALLOWED_ORIGINS` trong `lib/api-protection.ts`:

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://tmsmindx.vercel.app',
  'https://your-custom-domain.com',  // Thêm domain của bạn
  process.env.NEXT_PUBLIC_APP_URL || '',
].filter(Boolean);
```

### 3. Troubleshooting

**Lỗi 403 Forbidden:**
- Kiểm tra `NEXT_PUBLIC_APP_URL` đã đúng chưa
- Kiểm tra domain trong `ALLOWED_ORIGINS`
- Xem console logs trong Vercel để biết origin nào bị reject

**Lỗi 401 Unauthorized:**
- Token Firebase đã hết hạn → Đăng xuất và đăng nhập lại
- Kiểm tra `x-api-key` đã được gửi trong header chưa

**API chậm:**
- Data được cache 5 phút trong memory
- SWR cache thêm 60 giây trên client
- Compression được bật tự động bởi Vercel

## Monitoring

Theo dõi performance và errors tại:
- Vercel Analytics
- Vercel Logs
- Browser Console (F12)

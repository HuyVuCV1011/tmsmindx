# API Protection - Hướng Dẫn

## Tổng Quan

Hệ thống đã được cài đặt bảo vệ API để **ngăn chặn truy cập trực tiếp** vào các endpoints API. Người dùng chỉ có thể truy cập API thông qua giao diện ứng dụng.

## Cách Hoạt Động

### 1. **Middleware Bảo Vệ API** (`lib/api-protection.ts`)

File này cung cấp các function để validate requests:

- **`validateInternalRequest()`**: Kiểm tra request có hợp lệ không
- **`withApiProtection()`**: Wrapper function để bảo vệ API handlers
- **`createUnauthorizedResponse()`**: Tạo response lỗi khi truy cập không hợp lệ

### 2. **Các Điều Kiện Kiểm Tra**

Request được chấp nhận khi thỏa mãn **MỘT TRONG CÁC** điều kiện sau:

#### a) **Custom Header `x-api-key`** (Khuyến nghị)
- Client gửi header `x-api-key` với giá trị secret key
- Key mặc định: `mindx-teaching-internal-2025`
- Có thể thay đổi trong `.env.local`: `NEXT_PUBLIC_API_SECRET`

#### b) **Authorization Token** (Tự động cho authenticated users)
- Request có header `Authorization: Bearer <token>`
- Token đã được validate qua Firebase Authentication
- API `/api/teachers` sử dụng cơ chế này

**Lưu ý**: Chỉ cần thỏa mãn MỘT trong hai điều kiện trên là request sẽ được chấp nhận.

### 3. **API Đã Được Bảo Vệ**

Tất cả các API sau đã được áp dụng protection:

✅ `/api/training` - Thông tin đào tạo nâng cao
✅ `/api/teachers` - Thông tin giáo viên
✅ `/api/availability` - Lịch rảnh giáo viên
✅ `/api/feedback` - Gửi phản hồi
✅ `/api/rawdata` - Dữ liệu test chuyên môn
✅ `/api/rawdata-experience` - Dữ liệu test kỹ năng

### 4. **Frontend Integration**

Tất cả fetch requests từ frontend đã được cập nhật để include header `x-api-key`:

```typescript
// Trong file page.tsx
const API_SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET || 'mindx-teaching-internal-2025';

const fetcher = async (url: string) => {
  const res = await fetch(url, { 
    headers: { 
      'x-api-key': API_SECRET_KEY
    }
  });
  return res.json();
};
```

## Thử Nghiệm

### ❌ Truy cập trực tiếp qua browser/curl sẽ BỊ CHẶN:

```bash
# Không có API key hoặc Authorization token
curl http://localhost:3000/api/training?code=anhpt5

# Response:
{
  "error": "Access denied",
  "message": "This API endpoint can only be accessed through the application interface.",
  "details": "Unauthorized: Missing API key or authentication token"
}
```

### ✅ Truy cập qua giao diện ứng dụng sẽ HOẠT ĐỘNG BÌNH THƯỜNG:

- Mở trang web: `http://localhost:3000`
- Đăng nhập (tự động có Authorization token)
- Tìm kiếm giáo viên
- Tất cả API calls sẽ hoạt động vì có Authorization token hoặc `x-api-key`

## Cấu Hình

### Thay Đổi API Secret Key

1. Mở file `.env.local`
2. Thay đổi giá trị:
```env
NEXT_PUBLIC_API_SECRET=your-new-secret-key-here-12345
```
3. Restart development server

### Thêm Domain Được Phép

Mở `lib/api-protection.ts` và thêm domain vào array:

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://yourdomain.com',  // Thêm domain production
  process.env.NEXT_PUBLIC_APP_URL || '',
].filter(Boolean);
```

## Logs và Monitoring

Khi request bị chặn, hệ thống sẽ log thông tin:

```
[API Protection] Blocked request: Unauthorized: Missing or invalid API key
{
  url: 'http://localhost:3000/api/training?code=anhpt5',
  method: 'GET',
  ip: '127.0.0.1'
}
```

## Bảo Mật Nâng Cao (Optional)

Để tăng cường bảo mật hơn nữa, có thể:

1. **Sử dụng JWT Token**: Thay vì static API key, dùng JWT với expiration
2. **Rate Limiting**: Giới hạn số requests từ một IP
3. **CORS Configuration**: Cấu hình CORS chặt chẽ hơn
4. **IP Whitelist**: Chỉ cho phép truy cập từ các IP cụ thể

## Troubleshooting

### Lỗi: "Access denied" hoặc "Missing API key or authentication token"

**Nguyên nhân**: Không có `x-api-key` header và cũng không có Authorization token

**Giải pháp**: 
- Đảm bảo user đã đăng nhập (sẽ tự động có Authorization token)
- Hoặc check `.env.local` file có `NEXT_PUBLIC_API_SECRET`
- Restart development server
- Clear browser cache và reload

### API `/api/teachers` yêu cầu gì?

API này yêu cầu **Authorization token** (Bearer token từ Firebase). Token này được gửi tự động khi user đăng nhập, nên không cần thêm `x-api-key`.

### Các API khác cần gì?

Các API khác (`/api/training`, `/api/availability`, `/api/feedback`, etc.) có thể sử dụng:
- **x-api-key** header (được gửi tự động từ frontend)
- HOẶC **Authorization token** (nếu user đã đăng nhập)

### Lỗi: "Forbidden: Invalid origin"

**Nguyên nhân**: Request từ domain không được phép

**Giải pháp**:
- Thêm domain vào `ALLOWED_ORIGINS` trong `lib/api-protection.ts`
- Set `NEXT_PUBLIC_APP_URL` trong `.env.local`

## Best Practices

1. ✅ **Không commit** `.env.local` vào git
2. ✅ **Sử dụng secret key phức tạp** trong production
3. ✅ **Rotate API key định kỳ** (3-6 tháng/lần)
4. ✅ **Monitor logs** để phát hiện truy cập bất thường
5. ✅ **Test thoroughly** sau khi thay đổi cấu hình

## Files Đã Thay Đổi

- `lib/api-protection.ts` (NEW)
- `.env.local` (NEW)
- `app/api/training/route.ts`
- `app/api/teachers/route.ts`
- `app/api/availability/route.ts`
- `app/api/feedback/route.ts`
- `app/api/rawdata/route.ts`
- `app/api/rawdata-experience/route.ts`
- `app/admin/page1/page.tsx`
- `app/user/thongtingv/page.tsx`

## Kết Luận

Hệ thống API đã được bảo vệ toàn diện. Người dùng không thể truy cập trực tiếp vào API endpoints mà phải thông qua giao diện ứng dụng với API key hợp lệ.

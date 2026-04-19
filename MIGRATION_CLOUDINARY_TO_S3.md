# Migration: Cloudinary → Supabase S3 Storage

**Ngày:** 2025-01-XX  
**Trạng thái:** ✅ Hoàn tất

---

## Tổng quan

Project đã migrate hoàn toàn từ Cloudinary sang Supabase S3-compatible Storage. Tất cả upload, delete, và storage management đều dùng S3.

---

## Các file đã thay đổi

### 1. Core Library
- **`lib/supabase-s3.ts`** — Thêm helpers:
  - `getPublicObjectUrl()` — tạo public URL cho object
  - `deleteObject()` — xóa object
  - `parsePublicUrl()` — parse URL để lấy bucket + key
  - `listObjects()` — list objects trong bucket

### 2. Upload APIs (Server-side)
- **`app/api/upload-thumbnail/route.ts`** — Upload ảnh thumbnail lên S3 bucket `mindx-thumbnails`
- **`app/api/upload-question-image/route.ts`** — Upload ảnh câu hỏi lên S3 bucket `mindx-question-images`
- **`app/api/upload-video/route.ts`** — Upload video nhỏ (≤50MB) lên S3 bucket `mindx-videos`

### 3. Multipart Upload APIs (cho video lớn)
- **`app/api/upload-multipart-init/route.ts`** — Khởi tạo multipart upload
- **`app/api/upload-multipart-part/route.ts`** — Upload từng part (10MB/part)
- **`app/api/upload-multipart-complete/route.ts`** — Hoàn tất multipart upload

### 4. Truyền thông (Communications)
- **`app/api/truyenthong/posts/route.ts`** — Upload base64 images trong nội dung bài viết lên S3 bucket `mindx-posts-content`
- **`app/api/truyenthong/posts/[id]/route.ts`** — Xóa ảnh cũ trên S3 khi update/delete bài viết

### 5. Admin Storage Manager
- **`app/api/admin/cloudinary/route.ts`** — Rewrite thành S3 storage manager (list + delete objects)
- **`app/admin/cloudinary/page.tsx`** — UI admin manager (thêm bucket selector)

### 6. Client Upload Context
- **`components/UploadVideoContext.tsx`** — Rewrite hoàn toàn:
  - Video ≤50MB: upload trực tiếp qua `/api/upload-video`
  - Video >50MB: dùng S3 multipart upload (10MB/part)
  - **Loại bỏ FFmpeg chunking** (không còn cần thiết với S3 multipart)

### 7. Admin Pages (delete cleanup)
- **`app/admin/page5/page.tsx`** — Xóa video trên S3 thay vì Cloudinary
- **`app/admin/video-detail/page.tsx`** — Xóa video trên S3 thay vì Cloudinary

---

## S3 Buckets

| Bucket | Mục đích | Public? |
|--------|----------|---------|
| `mindx-videos` | Video đào tạo | ✅ Public |
| `mindx-thumbnails` | Thumbnail video | ✅ Public |
| `mindx-posts-content` | Ảnh trong bài viết truyền thông | ✅ Public |
| `mindx-question-images` | Ảnh câu hỏi | ✅ Public |
| `feedback-images` | Ảnh feedback | ✅ Public |

**Lưu ý:** Tất cả buckets phải được set **public** trong Supabase Dashboard để URL public hoạt động.

---

## Cấu hình môi trường

Các biến môi trường cần thiết (đã có sẵn trong `.env`):

```env
# Supabase S3-compatible storage
SUPABASE_S3_REGION=ap-south-1
SUPABASE_S3_ENDPOINT=https://wrlfozuzdblljlxwvbst.storage.supabase.co/storage/v1/s3
SUPABASE_S3_ACCESS_KEY_ID=713efc8b30b282c173ddcefdcaf796f1
SUPABASE_S3_SECRET_ACCESS_KEY=10a96982b9a445bd5c1a758378c5e8d15fdbfb5385c1b6f8860256581fbb6b3f
```

---

## URL Format

### Cloudinary (cũ)
```
https://res.cloudinary.com/dkanwimnc/video/upload/v1234567890/mindx_videos/abc123.mp4
```

### Supabase S3 (mới)
```
https://wrlfozuzdblljlxwvbst.supabase.co/storage/v1/object/public/mindx-videos/videos/1234567890-abc123.mp4
```

---

## Backward Compatibility

- **Admin delete** (`page5`, `video-detail`) chỉ xóa S3 URLs, bỏ qua Cloudinary URLs cũ
- **Truyền thông posts** chỉ xóa S3 images, bỏ qua Cloudinary images cũ
- Database vẫn có thể chứa Cloudinary URLs cũ — không ảnh hưởng đến hoạt động

---

## Testing Checklist

### Upload
- [ ] Upload thumbnail (≤5MB)
- [ ] Upload question image (≤5MB)
- [ ] Upload video nhỏ (≤50MB)
- [ ] Upload video lớn (>50MB) — multipart
- [ ] Upload base64 image trong bài viết truyền thông

### Delete
- [ ] Xóa video từ admin page5
- [ ] Xóa video từ admin video-detail
- [ ] Xóa bài viết truyền thông (xóa ảnh featured + banner)
- [ ] Update bài viết truyền thông (xóa ảnh cũ)

### Admin Manager
- [ ] List objects trong bucket
- [ ] Xóa object từ admin manager
- [ ] Switch giữa các buckets

---

## Rollback Plan

Nếu cần rollback về Cloudinary:

1. Restore các file từ git history:
   ```bash
   git checkout HEAD~1 -- app/api/upload-*.ts
   git checkout HEAD~1 -- app/api/cloudinary-signature/route.ts
   git checkout HEAD~1 -- components/UploadVideoContext.tsx
   git checkout HEAD~1 -- app/api/truyenthong/posts/
   git checkout HEAD~1 -- app/api/admin/cloudinary/route.ts
   ```

2. Xóa các API multipart:
   ```bash
   rm app/api/upload-multipart-*.ts
   ```

3. Restart dev server

---

## Performance Notes

### Cloudinary (cũ)
- Upload video >100MB: FFmpeg chunking (45MB/chunk) → chậm, tốn RAM browser
- Retry logic: 3 lần, 5s delay

### Supabase S3 (mới)
- Upload video >50MB: S3 multipart (10MB/part) → nhanh hơn, ít RAM hơn
- Không cần FFmpeg chunking
- Retry logic: 5 lần, exponential backoff

---

## Known Issues

### 1. Public bucket requirement
**Issue:** S3 public URLs chỉ hoạt động nếu bucket được set public trong Supabase Dashboard.  
**Solution:** Vào Supabase Dashboard → Storage → chọn bucket → Settings → set "Public bucket" = ON

### 2. CORS
**Issue:** Nếu upload từ client gặp CORS error.  
**Solution:** Supabase S3 endpoint đã hỗ trợ CORS mặc định, không cần config thêm.

### 3. Multipart upload timeout
**Issue:** Upload video rất lớn (>500MB) có thể timeout.  
**Solution:** Presigned URL có thời hạn 2 giờ, đủ cho hầu hết trường hợp. Nếu cần lâu hơn, tăng `expiresIn` trong `cloudinary-signature/route.ts`.

---

## Migration Complete ✅

Tất cả Cloudinary dependencies đã được loại bỏ. Project giờ hoàn toàn dùng Supabase S3 Storage.

**Cloudinary credentials trong `.env` có thể xóa sau khi verify migration thành công.**

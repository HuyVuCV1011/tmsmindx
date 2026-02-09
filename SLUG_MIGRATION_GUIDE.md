# Migration Guide: Chuyển từ ID sang Slug cho Posts

## Tổng quan

Hệ thống đã được cập nhật để sử dụng **slug** (URL thân thiện) thay vì **ID** để truy cập bài viết.

Ví dụ:

- **Trước:** `/user/truyenthong/123`
- **Sau:** `/user/truyenthong/thong-bao-ve-chinh-sach-moi`

## Các thay đổi đã thực hiện

### 1. Database

- ✅ Thêm cột `slug` vào bảng `communications`
- ✅ Tạo unique index cho `slug`
- ✅ Tự động generate slug từ title khi tạo/cập nhật bài viết

### 2. Backend API

- ✅ API endpoints hỗ trợ tìm kiếm bằng slug (backward compatible với ID)
- ✅ Auto-generate slug khi tạo bài viết mới
- ✅ Auto-update slug khi title thay đổi
- ✅ Đảm bảo slug luôn unique

### 3. Frontend

- ✅ User pages: `/user/truyenthong/[slug]`
- ✅ Admin pages: `/admin/truyenthong/posts/[slug]/edit`
- ✅ PostCard component sử dụng slug
- ✅ Tất cả links cập nhật sử dụng slug

## Cách Migration Database

### Bước 1: Cập nhật Schema

Chạy script init-db để tạo cột slug:

```bash
# Truy cập endpoint này trong browser hoặc Postman
GET http://localhost:3000/api/truyenthong/init-db
```

### Bước 2: Populate Slugs cho Posts Hiện Có

Chạy migration script:

```bash
# Nếu dùng PostgreSQL command line
psql -U postgres -d mindx -f scripts/migrate-add-slugs.sql

# Hoặc copy nội dung file và chạy trong database management tool
```

### Bước 3: Kiểm Tra

Verify rằng tất cả posts đã có slug:

```sql
SELECT id, title, slug FROM communications WHERE slug IS NULL;
-- Kết quả phải là 0 rows
```

## Lưu Ý Quan Trọng

### Backward Compatibility

API vẫn hỗ trợ tìm kiếm bằng ID cho các link cũ:

- API sẽ thử tìm bằng slug trước
- Nếu không tìm thấy, fallback về tìm bằng ID

### Slug Generation Rules

- Chuyển tiếng Việt sang không dấu
- Chuyển thành chữ thường
- Thay khoảng trắng bằng dấu gạch ngang (-)
- Xóa ký tự đặc biệt
- Đảm bảo unique bằng cách thêm số nếu trùng

### Ví dụ:

- "Thông Báo Về Chính Sách Mới" → `thong-bao-ve-chinh-sach-moi`
- "Đào Tạo Kỹ Năng 2026" → `dao-tao-ky-nang-2026`
- Nếu trùng: `dao-tao-ky-nang-2026-1`, `dao-tao-ky-nang-2026-2`, ...

## Testing Checklist

- [ ] Tạo bài viết mới → kiểm tra slug tự động generate
- [ ] Cập nhật title → kiểm tra slug tự động cập nhật
- [ ] Truy cập bài viết bằng slug trong user view
- [ ] Edit bài viết bằng slug trong admin
- [ ] Xóa bài viết bằng slug
- [ ] Like/View count hoạt động với slug
- [ ] Links cũ (dùng ID) vẫn hoạt động

## Rollback (Nếu cần)

Nếu gặp vấn đề, có thể rollback:

```sql
-- Remove unique constraint
DROP INDEX IF EXISTS idx_communications_slug;

-- Make slug nullable
ALTER TABLE communications ALTER COLUMN slug DROP NOT NULL;

-- Optional: Remove slug column
-- ALTER TABLE communications DROP COLUMN slug;
```

Sau đó revert code về commit trước khi áp dụng slug.

## Files Đã Thay Đổi

### Backend

- `lib/utils.ts` - Thêm hàm `generateSlug()`
- `app/api/truyenthong/init-db/route.ts` - Thêm cột slug
- `app/api/truyenthong/posts/route.ts` - Generate slug khi POST
- `app/api/truyenthong/posts/[id]/route.ts` - Hỗ trợ slug trong GET/PUT/DELETE
- `app/api/truyenthong/posts/[id]/like/route.ts` - Hỗ trợ slug
- `app/api/truyenthong/posts/[id]/view/route.ts` - Hỗ trợ slug

### Frontend

- `app/user/truyenthong/[slug]/page.tsx` - User view page
- `app/admin/truyenthong/posts/[slug]/edit/page.tsx` - Admin edit page
- `app/admin/truyenthong/posts/page.tsx` - Posts list page
- `app/admin/truyenthong/page.tsx` - Dashboard
- `components/post-card.tsx` - Post card component

## Support

Nếu gặp vấn đề, kiểm tra:

1. Database có cột `slug` chưa?
2. Tất cả posts đã có slug chưa?
3. Slug có unique không?
4. API endpoints đang dùng version mới chưa?

# Hướng dẫn quản lý bình luận cho Admin

## Bước 1: Chạy Migration Database

Trước khi sử dụng tính năng, bạn cần chạy migration để thêm cột `hidden` vào bảng `truyenthong_comments`:

**Cách 1: Truy cập URL migration**

```
http://localhost:3000/api/truyenthong/migrate-add-hidden-column
```

**Cách 2: Chạy SQL trực tiếp**

```sql
ALTER TABLE truyenthong_comments
ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_comments_hidden ON truyenthong_comments(hidden);
```

## Bước 2: Sử dụng tính năng

### Quyền của Admin:

1. **Ẩn bình luận**:
   - Nhấn nút "Ẩn" (icon khiên + mắt tắt, màu cam)
   - Bình luận sẽ bị ẩn khỏi người dùng thường
   - Admin vẫn có thể thấy được (nếu cần)

2. **Xóa bình luận**:
   - Nhấn nút "Xóa" (icon khiên + thùng rác, màu đỏ)
   - Bình luận sẽ bị xóa vĩnh viễn khỏi database
   - Không thể khôi phục

### Lưu ý:

- Chỉ tài khoản Admin mới thấy các nút này
- Người dùng thường chỉ có thể xóa/sửa bình luận của chính mình
- Bình luận bị ẩn sẽ không hiển thị cho người dùng thường

## API Endpoints đã được thêm:

1. **DELETE** `/api/truyenthong/comments/[commentId]`
   - Admin có thể xóa bất kỳ bình luận nào (cần truyền `userEmail` trong query)
   - User thường chỉ xóa được bình luận của mình

2. **PATCH** `/api/truyenthong/comments/[commentId]`
   - Admin toggle trạng thái hidden của bình luận
   - Body: `{ userEmail, hidden }`

3. **GET** `/api/truyenthong/posts/[id]/comments`
   - Đã được cập nhật để filter các bình luận bị ẩn (`hidden = true`)

# Rich Text Editor

## Tổng quan

Đã tích hợp **Tiptap Rich Text Editor** vào trang tạo và chỉnh sửa bài viết của admin.

## Tính năng

### 1. Định dạng văn bản

- **Bold** (Ctrl+B)
- **Italic** (Ctrl+I)
- **Underline** (Ctrl+U)
- **Code** (inline code)

### 2. Tiêu đề (Headings)

- Heading 1 (H1)
- Heading 2 (H2)
- Heading 3 (H3)

### 3. Danh sách

- Bullet List (danh sách không thứ tự)
- Ordered List (danh sách có thứ tự)

### 4. Căn lề văn bản

- Align Left (căn trái)
- Align Center (căn giữa)
- Align Right (căn phải)
- Justify (căn đều)

### 5. Chèn nội dung

- **Upload Image**: Tải ảnh lên từ máy tính và chèn vào nội dung
- **Link**: Thêm liên kết vào văn bản
- **Quote**: Tạo khối trích dẫn
- **Horizontal Line**: Thêm đường kẻ ngang

### 6. Undo/Redo

- Undo: Hoàn tác thao tác
- Redo: Làm lại thao tác đã hoàn tác

## Cách sử dụng

### Upload hình ảnh

1. Click vào icon **Image** (📷) trên thanh công cụ
2. Chọn file ảnh từ máy tính
3. Hình ảnh sẽ được tải lên server và tự động chèn vào nội dung

### Thêm liên kết

1. Bôi đen văn bản muốn thêm link
2. Click vào icon **Link** (🔗)
3. Nhập URL vào hộp thoại
4. Click OK để tạo liên kết

### Định dạng văn bản

- Sử dụng các nút trên thanh công cụ
- Hoặc dùng phím tắt (Ctrl+B, Ctrl+I, Ctrl+U)

## Các file đã thay đổi

### 1. Component mới

- `components/RichTextEditor.tsx` - Component Rich Text Editor

### 2. Trang được cập nhật

- `app/admin/truyenthong/posts/create/page.tsx` - Trang tạo bài viết mới
- `app/admin/truyenthong/posts/[id]/edit/page.tsx` - Trang chỉnh sửa bài viết

### 3. Styles

- `app/globals.css` - Thêm CSS cho Tiptap editor

### 4. Dependencies

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-underline": "^2.x",
  "@tiptap/extension-text-align": "^2.x",
  "@tiptap/extension-color": "^2.x",
  "@tiptap/extension-text-style": "^2.x"
}
```

## Lưu ý kỹ thuật

### Dynamic Import

Editor được import động với `next/dynamic` để tránh lỗi SSR:

```typescript
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
    ssr: false,
    loading: () => <div>Đang tải editor...</div>
})
```

### Upload hình ảnh

- Hình ảnh được upload thông qua API `/api/upload-thumbnail`
- Server xử lý upload và trả về URL
- URL được chèn vào editor dưới dạng thẻ `<img>`

### Lưu trữ nội dung

- Nội dung được lưu dưới dạng **HTML** vào database
- Khi hiển thị, chỉ cần render HTML trực tiếp

## Tùy chỉnh

### Thêm extension mới

Chỉnh sửa file `components/RichTextEditor.tsx`:

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    // Thêm extension mới ở đây
    YourNewExtension,
  ],
  // ...
});
```

### Tùy chỉnh toolbar

Sửa đổi phần toolbar trong component để thêm/bớt nút:

```typescript
<div className="bg-muted/30 border-b border-border p-2 flex flex-wrap gap-1">
    {/* Thêm nút mới ở đây */}
</div>
```

## Hỗ trợ

- Tài liệu Tiptap: https://tiptap.dev/
- Issues: Báo lỗi trong dự án

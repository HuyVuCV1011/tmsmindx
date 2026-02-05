# Hướng dẫn Import Câu hỏi Bài tập

## 📋 Cấu trúc File CSV

File CSV cần có các cột sau (theo đúng thứ tự):

| Cột | Bắt buộc | Mô tả | Ví dụ |
|-----|----------|-------|-------|
| `question_text` | ✅ | Nội dung câu hỏi | "Python là ngôn ngữ gì?" |
| `question_type` | ✅ | Loại câu hỏi | `multiple_choice`, `true_false`, `short_answer`, `essay` |
| `correct_answer` | ✅ | Đáp án đúng | "Ngôn ngữ thông dịch" |
| `options` | ⚠️ | Các lựa chọn (chỉ cho trắc nghiệm) | "Đáp án A\|Đáp án B\|Đáp án C\|Đáp án D" |
| `points` | ✅ | Điểm số | 1, 2, 5, 10 |
| `difficulty` | ✅ | Độ khó | `easy`, `medium`, `hard` |
| `explanation` | ❌ | Giải thích (tùy chọn) | "Giải thích đáp án..." |
| `image_url` | ❌ | Link hình ảnh (tùy chọn) | https://example.com/image.jpg |

## 🎯 Các loại câu hỏi (question_type)

### 1. `multiple_choice` - Trắc nghiệm
- **Bắt buộc**: `options` (phân tách bằng dấu `|`)
- **Ví dụ**: 
  ```csv
  "Python là gì?",multiple_choice,"Ngôn ngữ thông dịch","Ngôn ngữ thông dịch|Ngôn ngữ biên dịch|Ngôn ngữ máy|Assembly",1,easy,"Giải thích...",
  ```

### 2. `true_false` - Đúng/Sai
- **Bắt buộc**: `options` = `"Đúng|Sai"`
- **Đáp án**: Phải là `"Đúng"` hoặc `"Sai"`
- **Ví dụ**:
  ```csv
  "JavaScript chỉ chạy trên browser",true_false,"Sai","Đúng|Sai",1,medium,"JS có thể chạy trên Node.js",
  ```

### 3. `short_answer` - Trả lời ngắn
- **Không cần**: `options` (để trống)
- **Ví dụ**:
  ```csv
  "HTML là viết tắt của gì?",short_answer,"HyperText Markup Language",,2,easy,"HTML là ngôn ngữ đánh dấu",
  ```

### 4. `essay` - Tự luận
- **Không cần**: `options` (để trống)
- **Không bắt buộc**: `correct_answer` (có thể để trống)
- **Ví dụ**:
  ```csv
  "Giải thích khái niệm OOP",essay,,,5,hard,"OOP là lập trình hướng đối tượng",
  ```

## ⚙️ Độ khó (difficulty)

| Giá trị | Mô tả |
|---------|-------|
| `easy` | Dễ 😊 |
| `medium` | Trung bình 😐 |
| `hard` | Khó 😰 |

## 💯 Điểm số (points)

- Giá trị gợi ý: 1, 2, 5, 10
- Có thể sử dụng số khác

## ✅ Lưu ý quan trọng

1. **Dấu phân cách options**: Sử dụng dấu `|` (pipe) để phân tách các đáp án
2. **Dấu ngoặc kép**: Bao quanh nội dung có dấu phẩy hoặc xuống dòng
3. **Encoding**: Lưu file với encoding UTF-8 (có BOM) để hiển thị tiếng Việt đúng
4. **Dòng đầu tiên**: Là tên các cột (header), không được xóa
5. **Thứ tự cột**: Phải đúng như template
6. **Đáp án đúng**: Phải khớp chính xác với một trong các options (với trắc nghiệm)

## 📥 Cách sử dụng

1. **Tải file mẫu** từ nút "Tải file mẫu"
2. **Mở bằng Excel/Google Sheets**
3. **Thêm câu hỏi** của bạn (giữ nguyên dòng header)
4. **Lưu file** dạng CSV (UTF-8)
5. **Click "Import"** và chọn file vừa tạo

## 🚨 Các lỗi thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| "Invalid question type" | Sai tên loại câu hỏi | Kiểm tra lại: `multiple_choice`, `true_false`, `short_answer`, `essay` |
| "Missing options" | Thiếu đáp án cho trắc nghiệm | Thêm options, phân tách bằng `\|` |
| "Invalid difficulty" | Sai độ khó | Chỉ dùng: `easy`, `medium`, `hard` |
| "Tiếng Việt bị lỗi" | Sai encoding | Lưu file CSV với UTF-8 (có BOM) |
| "Correct answer not found" | Đáp án đúng không có trong options | Kiểm tra chính tả, phải khớp chính xác |

## 💡 Mẹo

- **Excel**: File → Save As → CSV UTF-8 (Comma delimited) (*.csv)
- **Google Sheets**: File → Download → Comma Separated Values (.csv)
- **Notepad++**: Encoding → Convert to UTF-8-BOM

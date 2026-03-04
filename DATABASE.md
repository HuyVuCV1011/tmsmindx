# 📦 DATABASE SCHEMA — TMS (Teaching Management System)

> **File này dùng cho AI agents** — Khi AI đọc project sẽ tự hiểu cấu trúc database.
> Auto-generated from `lib/migrations.ts`. Cập nhật khi thêm migration mới.

## Connection

- **Engine**: PostgreSQL
- **Config**: `lib/db.ts` → `pg.Pool` connection
- **Env vars**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- **Migration**: `lib/migrations.ts` (auto-run on app start)

---

## Tables

### 🔴 `_migrations`
> Track migration history, đảm bảo mỗi migration chỉ chạy 1 lần.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| name | VARCHAR(255) | UNIQUE, tên migration |
| version | INTEGER | Thứ tự version |
| applied_at | TIMESTAMP | Thời điểm apply |

---

### 📰 `communications`
> Bài viết truyền thông nội bộ (blog posts).

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | TEXT | NOT NULL |
| slug | TEXT | UNIQUE, NOT NULL |
| description | TEXT | Mô tả ngắn |
| content | TEXT | Nội dung HTML |
| featured_image | TEXT | URL ảnh đại diện |
| banner_image | TEXT | URL ảnh banner |
| post_type | TEXT | Loại bài viết |
| audience | TEXT | Đối tượng |
| status | TEXT | draft / published |
| published_at | TIMESTAMPTZ | |
| view_count | INTEGER | Default 0 |
| like_count | INTEGER | Default 0 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `communication_likes`
> Tracking likes cho bài viết.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| post_id | INTEGER | FK → communications.id |
| user_id | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | |

**Constraints**: UNIQUE(post_id, user_id)

---

### 💬 `post_comments`
> Comments cho bài viết communications.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| post_id | INTEGER | FK → communications.id |
| user_id | TEXT | NOT NULL |
| user_name | TEXT | NOT NULL |
| user_email | TEXT | |
| content | TEXT | NOT NULL |
| parent_id | INTEGER | FK → post_comments.id (reply) |
| is_hidden | BOOLEAN | Default false |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `comment_reactions`
> Reactions (like, love...) cho comments.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| comment_id | INTEGER | FK → post_comments.id |
| user_id | TEXT | NOT NULL |
| reaction_type | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | |

**Constraints**: UNIQUE(comment_id, user_id)

---

### 💬 `truyenthong_comments`
> Comments hệ thống truyền thông (alternate, dùng slug thay vì post_id).

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| post_slug | VARCHAR(255) | NOT NULL, slug bài viết |
| user_id | VARCHAR(255) | NOT NULL |
| user_name | VARCHAR(255) | NOT NULL |
| user_email | VARCHAR(255) | |
| content | TEXT | NOT NULL |
| parent_id | INTEGER | FK → self (reply) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `truyenthong_comment_reactions`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| comment_id | INTEGER | FK → truyenthong_comments.id |
| user_id | VARCHAR(255) | NOT NULL |
| reaction_type | VARCHAR(50) | NOT NULL |
| created_at | TIMESTAMP | |

**Constraints**: UNIQUE(comment_id, user_id)

---

### 📝 `explanations`
> Giải trình của giáo viên về kết quả kiểm tra.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| teacher_name | VARCHAR(255) | NOT NULL |
| lms_code | VARCHAR(100) | NOT NULL, mã LMS |
| email | VARCHAR(255) | NOT NULL |
| campus | VARCHAR(255) | NOT NULL |
| subject | VARCHAR(255) | NOT NULL |
| test_date | DATE | NOT NULL |
| reason | TEXT | NOT NULL, lý do giải trình |
| status | VARCHAR(50) | pending / accepted / rejected |
| admin_note | TEXT | Ghi chú admin |
| admin_email | VARCHAR(255) | |
| admin_name | VARCHAR(255) | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 🎓 `teacher_certificates`
> Chứng chỉ của giáo viên (upload Cloudinary).

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| teacher_email | VARCHAR(255) | NOT NULL |
| certificate_name | VARCHAR(500) | NOT NULL |
| certificate_url | TEXT | NOT NULL, Cloudinary URL |
| certificate_type | VARCHAR(100) | Language, Technology, Teaching |
| issue_date | DATE | |
| expiry_date | DATE | |
| description | TEXT | |
| cloudinary_public_id | VARCHAR(255) | Dùng để xoá trên Cloudinary |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 🔒 `teacher_privacy_settings`
> Cài đặt quyền riêng tư cho giáo viên.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| teacher_email | VARCHAR(255) | NOT NULL, UNIQUE |
| show_birthday | BOOLEAN | Default true |
| show_on_public_list | BOOLEAN | Default true |
| show_phone | BOOLEAN | Default false |
| show_personal_email | BOOLEAN | Default false |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 🎬 Training System (9 tables)

### `training_videos`
> Video đào tạo cho giáo viên.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| title | VARCHAR(500) | NOT NULL |
| video_link | VARCHAR(1000) | NOT NULL |
| start_date | DATE | NOT NULL |
| duration_minutes | INTEGER | |
| view_count | INTEGER | Default 0 |
| status | VARCHAR(20) | draft / active / inactive |
| description | TEXT | |
| thumbnail_url | VARCHAR(1000) | |
| lesson_number | INTEGER | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `training_video_questions`
> Câu hỏi trong video.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| video_id | INTEGER | FK → training_videos.id |
| question_text | TEXT | NOT NULL |
| question_type | VARCHAR(20) | multiple_choice / true_false / short_answer / open_ended |
| time_in_video | INTEGER | Giây |
| correct_answer | TEXT | |
| options | JSONB | Danh sách đáp án |
| points | DECIMAL(5,2) | Default 1.00 |
| order_number | INTEGER | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `training_video_assignments`
> Bài kiểm tra sau mỗi video.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| video_id | INTEGER | FK → training_videos.id |
| assignment_title | VARCHAR(500) | NOT NULL |
| assignment_type | VARCHAR(20) | quiz / test / exam / practice |
| description | TEXT | |
| total_points | DECIMAL(5,2) | Default 10.00 |
| passing_score | DECIMAL(5,2) | Default 7.00 |
| time_limit_minutes | INTEGER | |
| max_attempts | INTEGER | Default 1 |
| is_required | BOOLEAN | Default true |
| due_date | TIMESTAMP | |
| status | VARCHAR(20) | draft / published / closed |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `training_assignment_questions`
> Câu hỏi trong assignment.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| assignment_id | INTEGER | FK → training_video_assignments.id |
| question_text | TEXT | NOT NULL |
| question_type | VARCHAR(20) | multiple_choice / true_false / short_answer / essay / matching |
| correct_answer | TEXT | |
| options | JSONB | |
| image_url | VARCHAR(1000) | |
| explanation | TEXT | Giải thích đáp án |
| points | DECIMAL(5,2) | Default 1.00 |
| order_number | INTEGER | |
| difficulty | VARCHAR(10) | easy / medium / hard |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `training_assignment_submissions`
> Kết quả làm bài của giáo viên.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| teacher_code | VARCHAR(50) | NOT NULL |
| assignment_id | INTEGER | FK → training_video_assignments.id |
| attempt_number | INTEGER | Default 1 |
| score | DECIMAL(5,2) | Default 0 |
| total_points | DECIMAL(5,2) | |
| percentage | DECIMAL(5,2) | |
| is_passed | BOOLEAN | Default false |
| status | VARCHAR(20) | in_progress / submitted / graded |
| started_at | TIMESTAMP | |
| submitted_at | TIMESTAMP | |
| graded_at | TIMESTAMP | |
| time_spent_seconds | INTEGER | Default 0 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Constraints**: UNIQUE(teacher_code, assignment_id, attempt_number)

### `training_assignment_answers`
> Câu trả lời của GV trong assignment.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| submission_id | INTEGER | FK → training_assignment_submissions.id |
| question_id | INTEGER | FK → training_assignment_questions.id |
| answer_text | TEXT | |
| is_correct | BOOLEAN | Default false |
| points_earned | DECIMAL(5,2) | Default 0 |
| feedback | TEXT | |
| answered_at | TIMESTAMP | |

### `training_teacher_stats`
> Thống kê tổng hợp của giáo viên.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| teacher_code | VARCHAR(50) | NOT NULL, UNIQUE |
| full_name | VARCHAR(200) | NOT NULL |
| username | VARCHAR(100) | |
| work_email | VARCHAR(200) | NOT NULL |
| phone_number | VARCHAR(20) | |
| status | VARCHAR(50) | Default 'Active' |
| center | VARCHAR(200) | Cơ sở |
| teaching_block | VARCHAR(100) | Khối giảng dạy |
| position | VARCHAR(100) | Chức vụ |
| total_score | DECIMAL(5,2) | Default 0 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `training_teacher_video_scores`
> Điểm từng video của GV.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| teacher_code | VARCHAR(50) | FK-like → training_teacher_stats |
| video_id | INTEGER | FK → training_videos.id |
| score | DECIMAL(5,2) | Default 0 |
| completion_status | VARCHAR(20) | not_started / in_progress / completed |
| view_count | INTEGER | Default 0 |
| first_viewed_at | TIMESTAMP | |
| completed_at | TIMESTAMP | |
| time_spent_seconds | INTEGER | Default 0 |
| assigned_date | DATE | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

**Constraints**: UNIQUE(teacher_code, video_id)

### `training_teacher_answers`
> Câu trả lời của GV cho câu hỏi trong video.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| teacher_code | VARCHAR(50) | FK-like → training_teacher_stats |
| video_id | INTEGER | FK → training_videos.id |
| question_id | INTEGER | FK → training_video_questions.id |
| answer_text | TEXT | |
| is_correct | BOOLEAN | Default false |
| points_earned | DECIMAL(5,2) | Default 0 |
| answered_at | TIMESTAMP | |

---

## 🔗 Relationships Diagram

```
communications ──┬──< communication_likes
                 ├──< post_comments ──< comment_reactions
                 └──  (truyenthong_comments uses slug instead of FK)

training_videos ──┬──< training_video_questions
                  ├──< training_video_assignments ──< training_assignment_questions
                  ├──< training_teacher_video_scores
                  └──< training_teacher_answers

training_video_assignments ──< training_assignment_submissions ──< training_assignment_answers
training_assignment_questions ──< training_assignment_answers

training_teacher_stats ──┬──< training_teacher_video_scores
                         └──< training_teacher_answers
```

---

## 🛠️ Migration System

- **File**: `lib/migrations.ts` — chứa tất cả CREATE TABLE
- **Auto-run**: Khi app khởi động (`lib/db.ts` → `initDatabase()`)
- **Manual**: `npm run db:migrate`
- **Tracking**: Bảng `_migrations` ghi lại migration đã chạy
- **Thêm table mới**: Thêm entry cuối mảng `migrations` trong `lib/migrations.ts`

## 🔌 Database API

- `GET /api/database?action=overview` — List all tables + stats
- `GET /api/database?action=columns&table=X` — Table structure
- `GET /api/database?action=preview&table=X` — Preview data (pagination)
- `GET /api/database?action=export&table=X&format=csv|json` — Export
- `POST /api/database` — SQL query, migrations, CRUD operations

## 📌 Admin UI

- `/admin/database` — Database Manager (SQL Editor, Table Explorer, Export, CRUD)

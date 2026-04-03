# AGENTS.md — Hướng dẫn AI Agent

## Database Access

Project này có sẵn API để đọc database. Khi cần hiểu cấu trúc DB hoặc xem data, hãy dùng các cách sau:

### 1. Đọc schema từ source code
```
File: lib/migrations.ts
```
File này chứa tất cả CREATE TABLE. Đọc file này để biết toàn bộ tables và columns.

### 2. Gọi API database (khi dev server đang chạy)

**Xem danh sách tables:**
```bash
curl http://localhost:3000/api/database?action=overview
```

**Xem cấu trúc 1 table:**
```bash
curl "http://localhost:3000/api/database?action=columns&table=TÊN_TABLE"
```

**Xem data trong table:**
```bash
curl "http://localhost:3000/api/database?action=preview&table=TÊN_TABLE&limit=20"
```

**Chạy SQL query:**
```bash
curl -X POST http://localhost:3000/api/database \
  -H "Content-Type: application/json" \
  -d '{"action":"query","sql":"SELECT * FROM communications LIMIT 5","secret":"NEXT_PUBLIC_API_SECRET"}'
```

### 3. Thêm table mới

Mở `lib/migrations.ts`, thêm 1 entry cuối mảng `migrations`:
```typescript
{
  name: 'create_ten_table',
  version: NUMBER_TIEP_THEO,
  sql: `CREATE TABLE IF NOT EXISTS ten_table (...);`,
},
```
Restart app → table tự tạo.

## Skills & Knowledge Base

Tất cả AI Agent skills được tập trung tại một nơi:

**📍 Vị trí chính:** `.agents/skills/`

- `frontend-design/` - Thiết kế UI web production-grade
- `nextjs/` - Next.js 16 App Router + Server Components
- `shadcn-ui/` - Hướng dẫn shadcn/ui components
- `ui-ux-pro-max/` - UI/UX design (50 styles, 21 palettes)
- `web-accessibility/` - WCAG accessibility guidelines
- `postman/` - API lifecycle management
- Và nhiều skills khác...

👉 Mở `.agents/` folder trong VS Code để tìm skill bạn cần.

## Project Info

- **Stack**: Next.js 15 + TypeScript + PostgreSQL + Tailwind CSS
- **DB connection**: `lib/db.ts` (pg Pool, auto-migration on startup)
- **Auth**: Firebase Auth → `contexts/AuthContext.tsx`
- **Admin UI cho database**: `/admin/database`

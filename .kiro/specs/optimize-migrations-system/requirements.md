# Requirements Document: Optimize Migrations System

## Introduction

Hệ thống migration trong file `lib/migrations.ts` hiện tại có 3180 dòng với 62 migrations, gặp nhiều vấn đề nghiêm trọng về cú pháp SQL, dependencies thiếu, và performance. Document này định nghĩa các requirements để sửa lỗi ngay lập tức, cải thiện error handling, logging, và performance cho hệ thống migration.

## Glossary

- **Migration_System**: Hệ thống tự động chạy database migrations khi khởi động ứng dụng
- **Migration**: Một script SQL được version để thay đổi database schema hoặc data
- **DO_Block**: PostgreSQL anonymous code block sử dụng cú pháp `DO $$ ... END $$`
- **Pool**: PostgreSQL connection pool từ thư viện `pg`
- **PoolClient**: Một connection đơn lẻ được lấy từ Pool
- **Dependency_Table**: Một table mà migration khác tham chiếu đến qua foreign key hoặc query
- **Batch_Processing**: Kỹ thuật xử lý data theo từng batch nhỏ thay vì một lần toàn bộ
- **Transaction**: Một đơn vị công việc database có thể commit hoặc rollback
- **Applied_Migration**: Migration đã được chạy thành công và ghi vào bảng `_migrations`

## Requirements

### Requirement 1: Sửa lỗi cú pháp DO block

**User Story:** Là một developer, tôi muốn tất cả DO blocks sử dụng cú pháp đúng, để migrations có thể execute mà không gặp syntax error.

#### Acceptance Criteria

1. WHEN Migration_System chạy migration V2, THE Migration_System SHALL sử dụng cú pháp `$$` thay vì `$` cho function delimiter
2. WHEN Migration_System chạy migration V21, THE Migration_System SHALL sử dụng cú pháp `DO $$` thay vì `DO $`
3. WHEN Migration_System chạy migration V22, THE Migration_System SHALL sử dụng cú pháp `DO $$` thay vì `DO $`
4. WHEN Migration_System chạy migration V31, THE Migration_System SHALL sử dụng cú pháp `DO $$` thay vì `DO $`
5. WHEN Migration_System chạy migration V39, THE Migration_System SHALL sử dụng cú pháp `DO $$` thay vì `DO $`
6. WHEN Migration_System chạy migration V40, THE Migration_System SHALL sử dụng cú pháp `DO $$` thay vì `DO $`
7. WHEN Migration_System chạy migration V59, THE Migration_System SHALL sử dụng cú pháp `DO $$` thay vì `DO $`
8. WHEN Migration_System chạy migration V62, THE Migration_System SHALL sử dụng cú pháp `DO $$` thay vì `DO $`

### Requirement 2: Kiểm tra dependencies trước khi chạy migration

**User Story:** Là một developer, tôi muốn migrations kiểm tra dependencies trước khi chạy, để tránh lỗi foreign key constraint khi table tham chiếu chưa tồn tại.

#### Acceptance Criteria

1. WHEN migration V22 chạy, THE Migration_System SHALL kiểm tra table `roles` tồn tại trước khi tạo foreign key reference
2. IF table `roles` không tồn tại, THEN THE Migration_System SHALL log warning và skip tạo table `role_permissions`
3. WHEN migration V39 chạy, THE Migration_System SHALL kiểm tra table `roles` tồn tại trước khi tạo foreign key reference
4. IF table `roles` không tồn tại, THEN THE Migration_System SHALL log warning và skip migration
5. WHEN migration V40 chạy, THE Migration_System SHALL kiểm tra table `roles` tồn tại trước khi tạo foreign key reference
6. IF table `roles` không tồn tại, THEN THE Migration_System SHALL log warning và skip migration
7. WHEN migration V48 chạy, THE Migration_System SHALL kiểm tra các `exam_*` tables tồn tại trước khi tạo foreign key reference
8. IF các `exam_*` tables không tồn tại, THEN THE Migration_System SHALL log warning và skip migration

### Requirement 3: Tách migrations phức tạp thành migrations nhỏ hơn

**User Story:** Là một developer, tôi muốn migrations phức tạp được tách thành nhiều migrations nhỏ, để dễ debug, dễ rollback, và giảm thời gian chạy mỗi migration.

#### Acceptance Criteria

1. WHEN migration có hơn 200 dòng SQL, THE Migration_System SHALL được refactor thành nhiều migrations nhỏ hơn
2. WHEN migration tạo hơn 5 tables, THE Migration_System SHALL được tách thành nhiều migrations với mỗi migration tạo tối đa 3-4 tables
3. WHEN migration V43 chạy, THE Migration_System SHALL được tách thành 3 migrations riêng biệt: core tables, mapping tables, và data backfill
4. WHEN migration V48 chạy, THE Migration_System SHALL được tách thành 2-3 migrations riêng biệt theo nhóm chức năng

### Requirement 4: Thêm batch processing cho data migration

**User Story:** Là một developer, tôi muốn data migrations sử dụng batch processing, để tránh timeout và memory issues khi xử lý data lớn.

#### Acceptance Criteria

1. WHEN migration backfill data từ table có hơn 1000 rows, THE Migration_System SHALL sử dụng batch processing với batch size 1000
2. WHEN batch processing chạy, THE Migration_System SHALL log progress sau mỗi batch
3. WHEN migration V43 backfill data, THE Migration_System SHALL sử dụng LOOP với LIMIT và OFFSET
4. WHEN batch processing hoàn thành một batch, THE Migration_System SHALL log số lượng rows đã xử lý
5. WHEN batch processing không còn rows để xử lý, THE Migration_System SHALL exit loop và hoàn thành migration

### Requirement 5: Cải thiện error handling và logging

**User Story:** Là một developer, tôi muốn migration system có error handling tốt và logging chi tiết, để dễ dàng debug khi có lỗi xảy ra.

#### Acceptance Criteria

1. WHEN một migration fail, THE Migration_System SHALL rollback transaction và log error message chi tiết
2. WHEN một migration fail, THE Migration_System SHALL tiếp tục chạy các migrations tiếp theo thay vì dừng hẳn
3. WHEN một migration thành công, THE Migration_System SHALL log success message với tên migration
4. WHEN Migration_System bắt đầu chạy, THE Migration_System SHALL log tổng số migrations cần chạy
5. WHEN Migration_System hoàn thành, THE Migration_System SHALL log tổng số migrations đã apply và số lỗi
6. WHEN migration có dependency thiếu, THE Migration_System SHALL log warning với tên dependency table thiếu
7. WHEN migration được skip do dependency thiếu, THE Migration_System SHALL log skip reason

### Requirement 6: Đảm bảo transaction atomicity

**User Story:** Là một developer, tôi muốn mỗi migration chạy trong một transaction riêng biệt, để đảm bảo migration thành công hoàn toàn hoặc rollback hoàn toàn.

#### Acceptance Criteria

1. WHEN Migration_System chạy một migration, THE Migration_System SHALL bắt đầu transaction với BEGIN
2. WHEN migration SQL execute thành công, THE Migration_System SHALL insert record vào bảng `_migrations`
3. WHEN migration SQL execute thành công, THE Migration_System SHALL commit transaction
4. IF migration SQL execute thất bại, THEN THE Migration_System SHALL rollback transaction
5. WHEN transaction được rollback, THE Migration_System SHALL không insert record vào bảng `_migrations`
6. WHEN transaction được rollback, THE Migration_System SHALL không để lại partial changes trong database

### Requirement 7: Quản lý connection pool resources

**User Story:** Là một developer, tôi muốn migration system quản lý database connections đúng cách, để tránh connection leaks và resource exhaustion.

#### Acceptance Criteria

1. WHEN Migration_System bắt đầu chạy, THE Migration_System SHALL lấy một PoolClient từ Pool
2. WHEN Migration_System hoàn thành tất cả migrations, THE Migration_System SHALL release PoolClient về Pool
3. IF Migration_System gặp error, THEN THE Migration_System SHALL vẫn release PoolClient về Pool trong finally block
4. THE Migration_System SHALL sử dụng một PoolClient duy nhất cho tất cả migrations thay vì tạo nhiều connections
5. WHEN PoolClient được release, THE Migration_System SHALL log confirmation message

### Requirement 8: Đảm bảo migration idempotency

**User Story:** Là một developer, tôi muốn mỗi migration chỉ chạy một lần, để tránh duplicate data và schema conflicts khi restart application.

#### Acceptance Criteria

1. WHEN Migration_System khởi động, THE Migration_System SHALL query bảng `_migrations` để lấy danh sách Applied_Migration
2. WHEN Migration_System kiểm tra một migration, THE Migration_System SHALL skip migration nếu tên migration đã có trong Applied_Migration
3. WHEN Migration_System skip một migration, THE Migration_System SHALL không log error mà chỉ continue với migration tiếp theo
4. THE Migration_System SHALL đảm bảo mỗi migration name là unique trong danh sách migrations
5. WHEN migration được apply thành công, THE Migration_System SHALL insert record với name và version vào bảng `_migrations`

### Requirement 9: Backward compatibility với database hiện tại

**User Story:** Là một developer, tôi muốn các thay đổi trong migration system không ảnh hưởng đến database hiện tại, để đảm bảo application tiếp tục hoạt động bình thường.

#### Acceptance Criteria

1. THE Migration_System SHALL không sửa đổi bất kỳ migration nào đã được ghi trong bảng `_migrations`
2. THE Migration_System SHALL chỉ sửa code trong file `lib/migrations.ts`
3. WHEN Migration_System chạy trên database đã có data, THE Migration_System SHALL preserve tất cả data hiện tại
4. THE Migration_System SHALL sử dụng `CREATE TABLE IF NOT EXISTS` để tránh lỗi khi table đã tồn tại
5. THE Migration_System SHALL sử dụng `ALTER TABLE ADD COLUMN IF NOT EXISTS` để tránh lỗi khi column đã tồn tại
6. WHEN application khởi động với `npm run dev`, THE Migration_System SHALL chạy thành công mà không có lỗi

### Requirement 10: Performance optimization cho migrations phức tạp

**User Story:** Là một developer, tôi muốn migrations chạy nhanh và hiệu quả, để giảm thời gian khởi động application.

#### Acceptance Criteria

1. WHEN migration tạo indexes, THE Migration_System SHALL tạo indexes SAU khi insert data
2. WHEN migration có thể sử dụng CONCURRENTLY, THE Migration_System SHALL sử dụng `CREATE INDEX CONCURRENTLY`
3. WHEN migration backfill data lớn, THE Migration_System SHALL sử dụng batch processing với batch size hợp lý (1000 rows)
4. THE Migration_System SHALL tránh tạo quá nhiều indexes trong một migration (tối đa 3-4 indexes)
5. WHEN migration query dependency tables, THE Migration_System SHALL cache kết quả `to_regclass()` checks thay vì query nhiều lần

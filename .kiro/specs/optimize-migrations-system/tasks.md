# Implementation Plan: Optimize Migrations System

## Overview

Sửa lỗi cú pháp DO block, thêm defensive checks cho dependencies, và cải thiện error handling trong file `lib/migrations.ts`. Tất cả thay đổi chỉ trong file này, không sửa migrations đã chạy trong database.

## Tasks

- [-] 1. Sửa 8 lỗi cú pháp DO block (CRITICAL)
  - [ ] 1.1 Sửa V2: DO $ → DO $$ (line 48)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.1_
  
  - [ ] 1.2 Sửa V21: DO $ → DO $$ (line 621)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.2_
  
  - [ ] 1.3 Sửa V22: DO $ → DO $$ (line 638)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.3_
  
  - [ ] 1.4 Sửa V31: DO $ → DO $$ (line 731)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.4_
  
  - [ ] 1.5 Sửa V39: DO $ → DO $$ (line 1089)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.5_
  
  - [ ] 1.6 Sửa V40: DO $ → DO $$ (line 1169)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.6_
  
  - [ ] 1.7 Sửa V59: DO $ → DO $$ (line 2920)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.7_
  
  - [ ] 1.8 Sửa V62: DO $ → DO $$ (line 3061)
    - Thay thế `DO $` thành `DO $$` và `END $;` thành `END $$;`
    - _Requirements: 1.8_

- [~] 2. Checkpoint - Verify syntax fixes
  - Chạy `npm run dev` để verify không còn syntax errors
  - Ensure all tests pass, ask the user if questions arise.

- [~] 3. Thêm defensive checks cho 4 migrations với missing dependencies (HIGH)
  - [ ] 3.1 Thêm check table `roles` cho V22
    - Wrap toàn bộ SQL trong DO $$ block
    - Kiểm tra `to_regclass('public.roles')` trước khi tạo foreign key
    - Log warning và skip nếu table không tồn tại
    - _Requirements: 2.1, 2.2_
  
  - [ ] 3.2 Thêm check table `roles` cho V39
    - Wrap toàn bộ SQL trong DO $$ block
    - Kiểm tra `to_regclass('public.roles')` trước khi tạo foreign key
    - Log warning và skip nếu table không tồn tại
    - _Requirements: 2.3, 2.4_
  
  - [ ] 3.3 Thêm check table `roles` cho V40
    - Wrap toàn bộ SQL trong DO $$ block
    - Kiểm tra `to_regclass('public.roles')` trước khi tạo foreign key
    - Log warning và skip nếu table không tồn tại
    - _Requirements: 2.5, 2.6_
  
  - [ ] 3.4 Thêm check `exam_*` tables cho V48
    - Kiểm tra các tables: exam_subject_catalog, exam_sets, exam_set_questions, exam_registrations
    - Log warning và skip migration nếu thiếu bất kỳ table nào
    - _Requirements: 2.7, 2.8_

- [~] 4. Checkpoint - Verify defensive checks
  - Test migrations trên database mới (không có table `roles`)
  - Verify migrations skip gracefully với warning logs
  - Ensure all tests pass, ask the user if questions arise.

- [~] 5. Cải thiện error handling và logging (MEDIUM)
  - [ ] 5.1 Thêm detailed error logging trong runMigrations
    - Log tổng số migrations cần chạy khi bắt đầu
    - Log success message với tên migration khi thành công
    - Log error message chi tiết khi fail
    - Log tổng số migrations applied và errors khi hoàn thành
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 5.2 Thêm warning logs cho dependency checks
    - Log warning khi migration skip do dependency thiếu
    - Include tên dependency table trong warning message
    - _Requirements: 5.6, 5.7_

- [~] 6. Checkpoint - Verify error handling
  - Test với migration có lỗi cố ý
  - Verify error được log đúng và không crash app
  - Verify migrations tiếp theo vẫn chạy sau khi có lỗi
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 7. Tách migrations phức tạp (OPTIONAL - MEDIUM)
  - [ ]* 7.1 Tách V43 thành 3 migrations nhỏ hơn
    - V43_1: Tạo core tables (chuyensau_subjects, chuyensau_sets, chuyensau_questions)
    - V43_2: Tạo mapping tables (chuyensau_set_questions, chuyensau_monthly_selections)
    - V43_3: Backfill data với batch processing
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 7.2 Tách V48 thành 2-3 migrations nhỏ hơn
    - V48_1: Expand canonical tables
    - V48_2: Backfill data từ exam_* tables
    - V48_3: Drop exam_* tables và tạo compatibility views
    - _Requirements: 3.4_

- [ ]* 8. Thêm batch processing cho data migration (OPTIONAL - LOW)
  - [ ]* 8.1 Thêm batch processing cho V43 backfill
    - Sử dụng LOOP với LIMIT 1000 và OFFSET
    - Log progress sau mỗi batch
    - Exit loop khi không còn rows
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [~] 9. Final checkpoint - Integration testing
  - Chạy `npm run dev` trên database mới
  - Verify tất cả migrations chạy thành công
  - Verify không có breaking changes với database hiện tại
  - Test backward compatibility với data hiện có
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Chỉ sửa code trong file `lib/migrations.ts`, không sửa migrations đã chạy
- Phải backward compatible với database hiện tại
- Priority: CRITICAL (1-2) → HIGH (3-4) → MEDIUM (5-7) → LOW (8)
- Mỗi checkpoint là cơ hội để verify và test trước khi tiếp tục

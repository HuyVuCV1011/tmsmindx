# Thu Vien De - Schema V2

## Muc tieu

Refactor theo dung luong tinh nang hien tai:

1. Quan ly danh muc mon hoc theo key on dinh (khong phu thuoc label hien thi).
2. Quan ly bo de theo chat luong va setup (min cau hoi, scoring mode, random weight).
3. Quan ly cau hoi bo de co du metadata cho UI (difficulty, tags, is_active).
4. Quan ly setup de theo thang co audit ro rang (manual/random, lock mode, random seed, snapshot so cau).

## Bang va cot chinh

### 1) exam_subject_catalog

Cot bo sung:
- subject_key VARCHAR(120): key on dinh de mapping UI/API.
- display_order INTEGER: thu tu hien thi.
- metadata JSONB: du phong mo rong.

Y nghia:
- subject_code/subject_name la du lieu nghiep vu hien thi.
- subject_key la identity ky thuat, de tranh mismatch do doi ten nhan.

### 2) exam_sets

Cot bo sung:
- min_questions_required INTEGER: nguong toi thieu de duoc setup.
- scoring_mode VARCHAR(20): raw_10 | scaled_10 | weighted.
- random_weight INTEGER: trong so khi random.
- setup_note TEXT: ghi chu setup bo de.
- metadata JSONB: du lieu mo rong.
- archived_at TIMESTAMP: danh dau ngung su dung mem.

Rang buoc bo sung:
- min_questions_required > 0
- random_weight > 0
- total_points > 0
- 0 <= passing_score <= total_points
- scoring_mode nam trong tap cho phep

### 3) exam_set_questions

Cot bo sung:
- difficulty VARCHAR(20): easy | medium | hard
- tags TEXT[]
- is_active BOOLEAN
- metadata JSONB

Y nghia:
- UI Question Builder da co difficulty, nay luu that vao DB thay vi hardcode.
- tags/is_active phuc vu loc, tao de random, va governance sau nay.

### 4) monthly_exam_selections

Cot bo sung:
- setup_source VARCHAR(20): manual | random | auto
- lock_mode VARCHAR(20): locked | fallback_random
- random_seed VARCHAR(100)
- set_question_count_snapshot INTEGER
- selected_by TEXT
- selected_at TIMESTAMPTZ
- metadata JSONB

Y nghia:
- Theo doi ro setup de thang duoc tao bang cach nao.
- Co dau vet random (seed) de audit.
- Snapshot so cau tai thoi diem setup de doi chieu ve sau.

## Luong setup de de xuat

1. Admin chon bo de manual:
- selection_mode = manual
- setup_source = manual
- lock_mode = locked
- random_seed = NULL
- snapshot = so cau cua bo de tai luc chon

2. Admin random bo de:
- selection_mode = random
- setup_source = random
- lock_mode = fallback_random
- random_seed = sinh theo subject-thang-thoi diem
- snapshot = NULL (hoac co the set neu can track chat luong ngay luc random)

3. Job tu dong (neu co):
- setup_source = auto
- lock_mode tuy chinh theo chinh sach

## Tuong thich nguoc

- API cu van giu subject_code/subject_name.
- Bo sung subject_key de nang cap dan, khong gay vo man hinh cu.
- Ham mapping front-end uu tien subject_key, fallback sang match theo text.

## File da cap nhat

- app/api/exam-sets/route.ts
- app/api/exam-set-questions/route.ts
- app/api/monthly-exam-selections/route.ts
- app/admin/page4/thu-vien-de/subject-mapping.ts
- app/admin/page4/thu-vien-de/page.tsx
- app/admin/page4/thu-vien-de/subjects/[subjectId]/page.tsx
- lib/migrations.ts (V47)

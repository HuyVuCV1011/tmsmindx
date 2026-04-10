# REPORT - Thu vien de (Database & Van hanh)

Ngay tao: 2026-04-05
Pham vi: `/admin/thu-vien-de` va cac bang lien quan den tao de, random de, cham diem, giai trinh.

## 1) Ket luan nhanh

He thong thu vien de hien co dang gap 4 van de goc:

1. So luong bo de co the su dung rat thap so voi tong bo de dang ton tai.
2. Rule scale diem chua chuan hoa giua tong diem bo de va tong diem cau hoi.
3. Random/chon de dang cho phep chon nham bo de khong du cau hoi.
4. Quy tac dat ten/made (`set_code`) chua du chat, con trung va co ma legacy.

He qua: de duoc gan cho giao vien nhung co the khong thi duoc hoac diem khong phan anh dung nang luc.

## 2) So lieu thuc te tu DB (snapshot)

Nguon: query truc tiep qua API `/api/database`.

- Tong bo de: 31
- Bo de active: 31
- Bo de inactive: 0

Phan bo so cau hoi theo bo de:

- Bo de 0 cau hoi: 29
- Bo de < 10 cau hoi: 30
- Bo de >= 10 cau hoi: 1

Tinh trang monthly selection:

- Tong ban ghi `monthly_exam_selections`: 13
- Chua chon bo de (`selected_set_id IS NULL`): 3
- Da chon bo de va co cau hoi: 4
- Da chon bo de nhung bo de rong cau hoi: 6

Tinh trang ma de (`set_code`) bi trung:

- `COD-SCR-01`: 2 ban ghi
- `LEGACY-QUY_TR_NH_TRAI_NGHI_M`: 2 ban ghi
- `ROB-VEX-01`: 2 ban ghi

Lech scale diem bo de:

- Co bo de `total_points = 10` nhung `sum(question.points) = 25` (25 cau x 1 diem), gay mau thuan rule tinh diem.

## 3) Danh gia theo yeu cau nghiep vu

### 3.1 Scale diem (10 cau, 30 cau, ...)

Trang thai hien tai:

- Cung mot gia tri `total_points = 10` duoc gan cho nhieu bo de.
- Tong diem cau hoi (`sum(points)`) khong bat buoc bang `total_points`.

Rui ro:

- Cham diem theo so cau dung co the vuot tong diem bo de.
- So sanh ket qua giua cac bo de khac nhau mat cong bang.

De xuat rule chuan:

1. Duy tri thang diem dich co dinh la 10.
2. Diem raw = tong diem cau dung (`raw_score`).
3. Diem chuan hoa:

   `normalized_score = ROUND(raw_score * 10.0 / NULLIF(sum_question_points, 0), 2)`

4. `passing_score` luon dat theo thang 10 (vi du: 7.00).

Loi ich:

- Bo de 10 cau, 20 cau, 30 cau deu quy ve cung thang diem 10.
- So sanh ket qua lien thang chuan va minh bach.

### 3.2 Random/chon de vao thoi diem nao

Trang thai hien tai:

- Co random o thoi diem dang ky/backfill assignment.
- Co monthly selection override, nhung van co truong hop chon nham bo de rong cau hoi.

De xuat van hanh:

1. Chot de cho thang truoc ngay mo dang ky (cap thang/subject).
2. Khi GV dang ky, he thong chi copy assignment tu bo de da chot.
3. Neu chua chot de thang: cho phep random fallback, nhung chi random trong tap bo de dat dieu kien chat luong.

Dieu kien toi thieu de duoc random/chon:

- `status = 'active'`
- So cau hoi >= nguong toi thieu (vd: 10)
- `sum_question_points > 0`
- Khong bi khoa/khong bi disable van hanh

### 3.3 Check du so cau truoc khi cho phep mo lich/thi

Trang thai hien tai:

- Co kha nang assignment tro den set 0 cau hoi.

De xuat gate bat buoc:

1. Truoc khi tao/sua `monthly_exam_selections`: validate bo de du dieu kien.
2. Truoc khi tao assignment: validate lai bo de.
3. Neu fail: tra loi loi nghiep vu ro rang (HTTP 400), khong tao assignment nua.

Rule goi y:

- `MIN_QUESTIONS_PER_SET = 10` (cau hinh bang env)
- `sum_question_points >= 10` hoac >= nguong do hoi dong quy dinh

### 3.4 Quy tac ten de va ma de (`set_code`)

Trang thai hien tai:

- Con set_code trung lap.
- Con ma `LEGACY-*` va format khong dong nhat.

De xuat naming policy:

Format de xuat:

`{EXAMTYPE}-{BLOCK}-{SUBJECT}-{LEVEL?}-{SEQ}`

Vi du:

- `EXP-COD-SCRATCH-BASIC-01`
- `EXP-ROB-VEXGO-INT-02`

Rule bat buoc:

1. `set_code` UNIQUE toan he thong.
2. Chi cho phep ky tu `[A-Z0-9-]`.
3. Cam tien to `LEGACY-` cho ban ghi moi.
4. `set_name` bat buoc co y nghia, cam ten chung chung nhu `TEST`.

## 4) De xuat thay doi schema/constraint

### 4.1 Constraint va index

- Them unique index cho `exam_sets(set_code)` sau khi da cleanup duplicate.
- Them check/trigger dam bao `total_points > 0`, `passing_score <= total_points`.
- Co cot `min_question_required` theo subject hoac theo exam_type de cau hinh nguong linh hoat.

### 4.2 Materialized view/derived stats (tuy chon)

Tao view tong hop chat luong bo de:

- `question_count`
- `sum_question_points`
- `is_eligible_for_assignment`

De admin page load nhanh va de canh bao do/ xanh theo trang thai san sang.

## 5) De xuat thay doi service/API

1. API `monthly-exam-selections`:
- Tu choi set khong du dieu kien.
- Tra ve reason cu the (khong du so cau, tong diem = 0, set inactive).

2. API `exam-registrations`:
- Khi tao assignment, chi nhan set hop le.
- Neu khong co set hop le: tao registration + ghi chu trang thai cho admin xu ly, khong tao assignment loi.

3. API `exam-submissions`:
- Luu ca `raw_score`, `normalized_score`, `sum_question_points` vao ket qua.
- `chuyen_sau_results.diem` nen la normalized score (thang 10).

## 6) Lo trinh cleanup du lieu (khuyen nghi)

Phase 1 - Chuan hoa code va ten:

- Doi ten cac `set_name` chung chung (`TEST`, `Legacy Set - ...`) thanh ten co nghia.
- Doi `set_code` ve format chuan va xu ly duplicate.

Phase 2 - Chuan hoa cau hoi:

- Danh dau tat ca bo de < nguong cau hoi la `draft`/`inactive`.
- Bo sung cau hoi den nguong toi thieu truoc khi mo su dung.

Phase 3 - Chuan hoa diem:

- Dong bo `sum(question.points)` va `total_points` theo rule da chon.
- Kich hoat normalized score trong submit flow.

Phase 4 - Khoa gate van hanh:

- Bat buoc validate o monthly selection + assignment.
- Khong cho phep random vao bo de khong dat chat luong.

## 7) Trang thai route va permission

Da chuyen route chuan sang:

- `/admin/thu-vien-de`

Da bo sung migration cap quyen tu dong cho route moi (tu du lieu quyen cu):

- Migration moi trong `lib/migrations.ts`: `V42_canonical_thu_vien_de_route_permissions`.

Muc tieu:

- User dang co quyen `/admin/page4/thu-vien-de` se tu dong co quyen route moi.
- Giam nguy co mat quyen truy cap khi doi URL canonical.

## 7.1 Trang thai trien khai database moi `chuyen_sau_*`

Da trien khai migration tao bo schema moi prefix `chuyen_sau_`:

- Migration: `V43_create_chuyensau_database_model`
- File: `lib/migrations.ts`

Bao gom cac nhom bang:

- Danh muc: `chuyen_sau_monhoc`, `chuyen_sau_bode`, `chuyen_sau_cauhoi`, `chuyen_sau_bode_cauhoi`
- Van hanh thang: `chuyen_sau_chonde_thang`
- Dang ky/phan cong/thi: `chuyen_sau_dangky`, `chuyen_sau_phancong`, `chuyen_sau_bainop`, `chuyen_sau_bainop_traloi`
- Giai trinh + ket qua: `chuyen_sau_giaitrinh`, `chuyen_sau_ketqua`
- View chat luong: `chuyen_sau_chatluong_bode`

Trong migration da co backfill ban dau tu he cu:

- `exam_subject_catalog` -> `chuyen_sau_subjects`
- `exam_sets` -> `chuyen_sau_sets` (co normalize `set_code`, xu ly duplicate)
- `exam_set_questions` -> `chuyen_sau_questions` + `chuyen_sau_set_questions`
- `monthly_exam_selections` -> `chuyen_sau_monthly_selections`

Luu y van hanh:

- Can restart app/deploy de migration chay.
- Sau khi migration chay xong, co the bat dau chuyen API tu `exam_*` sang `chuyen_sau_*` theo tung phase an toan.
- Da co migration doi ten nghiep vu (`V44_rename_chuyensau_tables_meaningful`) va migration chuan hoa prefix (`V45_normalize_prefix_to_chuyen_sau`) de giu alias tuong thich nguoc.

## 8) Checklist nghiep vu de “an toan van hanh”

1. Khong cho set active neu < 10 cau.
2. Khong cho monthly selection chon set khong dat.
3. Khong cho assignment tao tren set rong.
4. Score luon quy ve thang 10 de so sanh cong bang.
5. set_code bat buoc unique + dung format.
6. Loai bo dan cac ma/tieu de legacy khong chuan.

---

Neu can, buoc tiep theo co the la tao 1 migration SQL cleanup tu dong (rename set_code, set inactive cho bo de khong dat, tao unique index) de chuyen trang thai he thong sang an toan ngay lap tuc.

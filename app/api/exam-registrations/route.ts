/**
 * exam-registrations/route.ts
 *
 * Flow mới: Registration = tạo record trong chuyen_sau_results
 *   - Không còn bảng chuyen_sau_dangky / chuyen_sau_phancong
 *   - GET  → xem lịch thi / results của user
 *   - POST → đăng ký = INSERT chuyen_sau_results (trang_thai = 'da_dang_ky')
 *   - PUT  → cập nhật trạng thái result (hủy, bắt đầu, v.v.)
 *   - DELETE → hủy đăng ký (xóa result nếu chưa thi)
 */

import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code') || searchParams.get('ma_giao_vien');
    const email = searchParams.get('email') || searchParams.get('dia_chi_email');
    const subjectCode = searchParams.get('subject_code') || searchParams.get('ma_mon');
    const blockCode = searchParams.get('block_code') || searchParams.get('ma_khoi');
    const scheduleId = searchParams.get('schedule_id') || searchParams.get('id_su_kien');
    const resultId = searchParams.get('result_id');
    const thangDk = searchParams.get('thang_dk');
    const namDk = searchParams.get('nam_dk');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (resultId) {
      conditions.push(`r.id = $${values.length + 1}`);
      values.push(resultId);
    }
    if (scheduleId) {
      conditions.push(`r.id_su_kien = $${values.length + 1}`);
      values.push(scheduleId);
    }
    if (teacherCode) {
      conditions.push(`LOWER(TRIM(COALESCE(r.ma_giao_vien, ''))) = LOWER(TRIM($${values.length + 1}))`);
      values.push(teacherCode);
    }
    if (email) {
      conditions.push(`LOWER(TRIM(COALESCE(r.dia_chi_email, ''))) = LOWER(TRIM($${values.length + 1}))`);
      values.push(email);
    }
    if (subjectCode) {
      conditions.push(`mh.ma_mon = $${values.length + 1}`);
      values.push(subjectCode);
    }
    if (blockCode) {
      conditions.push(`mh.ma_khoi = $${values.length + 1}`);
      values.push(blockCode);
    }
    if (thangDk) {
      conditions.push(`r.thang_dk = $${values.length + 1}`);
      values.push(thangDk);
    }
    if (namDk) {
      conditions.push(`r.nam_dk = $${values.length + 1}`);
      values.push(namDk);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         r.id                                                          AS id,
         r.id                                                          AS result_id,
         r.id_su_kien                                                  AS schedule_id,
         r.id_mon                                                      AS subject_id,
         r.ma_giao_vien                                                AS teacher_code,
         r.ho_ten,
         r.dia_chi_email                                               AS email,
         r.co_so_lam_viec                                              AS center_code,
         r.khu_vuc,
         r.hinh_thuc,
         r.khoi_giang_day                                              AS block_code,
         r.thang_dk,
         r.nam_dk,
         r.dot,
         r.thoi_gian_kiem_tra,
         r.diem                                                        AS score,
         r.cau_dung                                                    AS correct_answers,
         r.xu_ly_diem,
         r.tong_diem_bi_tru,
         r.email_giai_trinh,
         r.da_giai_thich,
         r.so_lan_giai_thich,
         r.id_de_thi                                                   AS set_id,
         r.id_de_thi                                                   AS selected_set_id,
         r.tao_luc                                                     AS created_at,
         r.dang_ky_luc,
         mh.ma_mon                                                     AS subject_code,
         mh.ten_mon                                                    AS subject_name,
         mh.ma_khoi                                                    AS subject_block,
         COALESCE(mh.loai_ky_thi, 'expertise')                        AS exam_type,
         mh.thoi_gian_thi_phut                                         AS duration_minutes,
         es.ten                                                        AS schedule_name,
         es.bat_dau_luc                                                AS open_at,
         es.ket_thuc_luc                                               AS close_at,
         COALESCE(es.bat_dau_luc, r.tao_luc)                          AS scheduled_at,
         es.loai_su_kien,
         -- registration_type: map hinh_thuc → official/additional
         CASE
           WHEN LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%b%sung%'
             OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) LIKE '%bo%'
             OR LOWER(TRIM(COALESCE(r.hinh_thuc, ''))) = 'additional'
           THEN 'additional'
           ELSE 'official'
         END                                                           AS registration_type,
         -- source_form
         COALESCE(r.hinh_thuc, 'system')                              AS source_form,
         -- assignment_id: non-null if any processing has been done
         CASE WHEN r.xu_ly_diem IS NOT NULL OR r.diem IS NOT NULL OR r.da_giai_thich = TRUE
              THEN r.id ELSE NULL END                                  AS assignment_id,
         -- assignment_status
         CASE
           WHEN LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) IN ('đã hoàn thành', 'da thi', 'đã duyệt', 'từ chối')
             THEN 'graded'
           WHEN r.diem IS NOT NULL AND r.diem > 0
             THEN 'graded'
           WHEN LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) = 'chờ giải trình'
             THEN 'expired'
           WHEN r.id_de_thi IS NOT NULL
             THEN 'assigned'
           ELSE 'assigned'
         END                                                           AS assignment_status,
         -- score_status
         CASE
           WHEN LOWER(TRIM(COALESCE(r.xu_ly_diem, ''))) IN ('đã hoàn thành', 'đã duyệt', 'từ chối')
             THEN 'graded'
           WHEN r.diem IS NULL
             THEN 'null'
           ELSE 'graded'
         END                                                           AS score_status,
         -- random_assigned_at
         NULL::timestamp                                               AS random_assigned_at,
         bode.ma_de                                                    AS set_code,
         bode.ten_de                                                   AS set_name,
         bode.tong_diem                                                AS total_points,
         bode.diem_dat                                                 AS passing_score
       FROM chuyen_sau_results r
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       LEFT JOIN event_schedules es ON es.id::text = r.id_su_kien::text
       LEFT JOIN chuyen_sau_bode bode ON bode.id = r.id_de_thi
       ${where}
       ORDER BY r.tao_luc DESC`,
      values
    );

    return NextResponse.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch registrations' }, { status: 500 });
  }
}

// ─── POST: Đăng ký thi → tạo results record ──────────────────────────────────

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const teacherInfo = body.teacher_info || {};
    // Accept both Vietnamese and English field names, fallback to teacher_info object
    const ma_giao_vien = body.ma_giao_vien || body.teacher_code;
    const ho_ten = body.ho_ten || body.full_name || teacherInfo.teacher_name || teacherInfo.full_name;
    const dia_chi_email = body.dia_chi_email || body.email || teacherInfo.email;
    const co_so_lam_viec = body.co_so_lam_viec || body.campus || teacherInfo.campus;
    const khu_vuc = body.khu_vuc || body.region || teacherInfo.region;
    const hinh_thuc = body.hinh_thuc || body.registration_type;
    const khoi_giang_day = body.khoi_giang_day || body.block_code;
    const dot = body.dot;
    const id_mon = body.id_mon || body.subject_id;
    const ma_mon = body.ma_mon || body.subject_code;
    // Resolve id_su_kien — frontend có thể gửi nhiều field name khác nhau
    const id_su_kien = body.id_su_kien || body.schedule_id || body.scheduled_event_id || null;
    const id_de_thi = body.id_de_thi;

    // Resolve thang_dk/nam_dk: ưu tiên explicit, fallback từ open_at/scheduled_at
    let thang_dk = body.thang_dk || body.month;
    let nam_dk = body.nam_dk || body.year;
    if ((!thang_dk || !nam_dk) && (body.open_at || body.scheduled_at)) {
      const refDate = new Date(body.open_at || body.scheduled_at);
      if (!Number.isNaN(refDate.getTime())) {
        thang_dk = thang_dk || (refDate.getMonth() + 1);
        nam_dk = nam_dk || refDate.getFullYear();
      }
    }

    if (!ma_giao_vien) {
      return NextResponse.json({ success: false, error: 'ma_giao_vien là bắt buộc' }, { status: 400 });
    }
    if (!id_mon && !ma_mon) {
      return NextResponse.json({ success: false, error: 'Cần cung cấp id_mon hoặc ma_mon' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Nếu ho_ten không được cung cấp, tự lookup từ bảng teachers theo mã giáo viên
    let resolvedHoTen = ho_ten;
    if (!resolvedHoTen) {
      const teacherRow = await client.query(
        `SELECT full_name FROM teachers WHERE LOWER(TRIM(code)) = LOWER(TRIM($1)) LIMIT 1`,
        [ma_giao_vien]
      );
      resolvedHoTen = teacherRow.rows[0]?.full_name || ma_giao_vien;
    }

    // Resolve subject ID if not provided
    let resolvedSubjectId = id_mon;
    if (!resolvedSubjectId && ma_mon) {
      // Tìm chính xác trước, sau đó thử tìm theo prefix (vd: "[COD] Scratch (S)" → "[COD] Scratch")
      const subj = await client.query(
        `SELECT id FROM chuyen_sau_monhoc
         WHERE ma_mon = $1
            OR $1 LIKE (ma_mon || '%')
            OR ma_mon LIKE ($1 || '%')
         ORDER BY
           CASE WHEN ma_mon = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [ma_mon]
      );
      if (subj.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Không tìm thấy môn học tương ứng' }, { status: 404 });
      }
      resolvedSubjectId = subj.rows[0].id;
    }

    // Tự động chọn đề từ thư viện đề tháng (nếu client không tự ấn định id_de_thi)
    let resolvedSetId = id_de_thi;
    if (!resolvedSetId && resolvedSubjectId && thang_dk && nam_dk) {
      const activeMonthlySet = await client.query(
        `SELECT id_de FROM chuyen_sau_chonde_thang WHERE id_mon = $1 AND nam = $2 AND thang = $3 LIMIT 1`,
        [resolvedSubjectId, nam_dk, thang_dk]
      );
      if (activeMonthlySet.rows.length > 0) {
        resolvedSetId = activeMonthlySet.rows[0].id_de;
      }
    }

    // Kiểm tra trùng theo id_su_kien: mỗi giáo viên chỉ được đăng ký 1 lần cho mỗi lịch thi
    if (id_su_kien) {
      const dupEvent = await client.query(
        `SELECT id FROM chuyen_sau_results
         WHERE id_su_kien = $1::uuid
           AND LOWER(TRIM(ma_giao_vien)) = LOWER(TRIM($2))
         LIMIT 1`,
        [id_su_kien, ma_giao_vien]
      );
      if (dupEvent.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Bạn đã đăng ký lịch thi này rồi.', result_id: dupEvent.rows[0].id },
          { status: 409 }
        );
      }
    }

    // Kiểm tra trùng đăng ký (cùng giáo viên + môn + tháng, chỉ block nếu chưa có điểm thực)
    // Nếu có id_su_kien thì chỉ block khi cùng sự kiện — mỗi sự kiện khác nhau được đăng ký độc lập
    const dupCond: string[] = ['id_mon = $1', `LOWER(TRIM(ma_giao_vien)) = LOWER(TRIM($2))`, `xu_ly_diem = 'chờ giải trình'`];
    const dupVals: unknown[] = [resolvedSubjectId, ma_giao_vien];

    if (id_su_kien) {
      dupCond.push(`id_su_kien = $${dupVals.length + 1}::uuid`);
      dupVals.push(id_su_kien);
    } else if (thang_dk && nam_dk) {
      dupCond.push(`thang_dk = $${dupVals.length + 1}`);
      dupVals.push(thang_dk);
      dupCond.push(`nam_dk = $${dupVals.length + 1}`);
      dupVals.push(nam_dk);
    }

    const dup = await client.query(
      `SELECT id FROM chuyen_sau_results WHERE ${dupCond.join(' AND ')} LIMIT 1`,
      dupVals
    );
    if (dup.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Giáo viên đã đăng ký môn học này rồi.', result_id: dup.rows[0].id },
        { status: 409 }
      );
    }

    const insertResult = await client.query(
      `INSERT INTO chuyen_sau_results (
         ma_giao_vien, ho_ten, dia_chi_email, co_so_lam_viec,
         khu_vuc, hinh_thuc, khoi_giang_day,
         thang_dk, nam_dk, dot,
         id_mon, id_su_kien, id_de_thi,
         diem, xu_ly_diem, dang_ky_luc
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 'chờ giải trình', NOW())
       RETURNING *`,
      [
        ma_giao_vien,
        resolvedHoTen,
        dia_chi_email || null,
        co_so_lam_viec || null,
        khu_vuc || null,
        hinh_thuc || null,
        khoi_giang_day || null,
        thang_dk || null,
        nam_dk || null,
        dot || null,
        resolvedSubjectId,
        id_su_kien || null,
        resolvedSetId || null,
      ]
    );

    await client.query('COMMIT');
    return NextResponse.json(
      { success: true, data: insertResult.rows[0], message: 'Đăng ký thi thành công' },
      { status: 201 }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating registration:', error);
    return NextResponse.json({ success: false, error: 'Failed to create registration' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ─── PUT: Cập nhật trạng thái result ─────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { result_id, status, set_code, notes } = body;

    if (!result_id) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }

    const clauses: string[] = [];
    const values: unknown[] = [];

    const { id_de_thi, xu_ly_diem, diem, cau_dung, email_giai_trinh, da_giai_thich } = body;

    if (id_de_thi !== undefined) {
      clauses.push(`id_de_thi = $${values.length + 1}`);
      values.push(id_de_thi);
    }
    if (xu_ly_diem !== undefined) {
      clauses.push(`xu_ly_diem = $${values.length + 1}`);
      values.push(xu_ly_diem);
    }
    if (diem !== undefined) {
      clauses.push(`diem = $${values.length + 1}`);
      values.push(diem);
    }
    if (cau_dung !== undefined) {
      clauses.push(`cau_dung = $${values.length + 1}`);
      values.push(cau_dung);
    }
    if (email_giai_trinh !== undefined) {
      clauses.push(`email_giai_trinh = $${values.length + 1}`);
      values.push(email_giai_trinh);
    }
    if (da_giai_thich !== undefined) {
      clauses.push(`da_giai_thich = $${values.length + 1}`);
      values.push(da_giai_thich);
    }

    if (clauses.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có trường nào để cập nhật' }, { status: 400 });
    }

    values.push(result_id);
    const result = await pool.query(
      `UPDATE chuyen_sau_results SET ${clauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy result' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating registration:', error);
    return NextResponse.json({ success: false, error: 'Failed to update registration' }, { status: 500 });
  }
}

// ─── DELETE: Hủy đăng ký (chỉ được khi chưa thi) ────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resultId = searchParams.get('result_id');

    if (!resultId) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }

    // Chỉ cho xóa nếu chưa thi (xu_ly_diem = 'chờ giải trình' = chưa nộp bài)
    const result = await pool.query(
      `DELETE FROM chuyen_sau_results
       WHERE id = $1 AND xu_ly_diem = 'chờ giải trình'
       RETURNING id, dia_chi_email, ma_giao_vien`,
      [resultId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không thể hủy - result không tồn tại hoặc đã thi rồi.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: 'Đã hủy đăng ký thành công' });
  } catch (error) {
    console.error('Error deleting registration:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete registration' }, { status: 500 });
  }
}

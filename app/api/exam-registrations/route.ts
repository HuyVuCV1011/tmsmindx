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
import { insertExamRegistration } from '@/lib/exam-registration-insert';
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
  } catch (error: unknown) {
    const pgErr = error as { code?: string; message?: string };
    if (pgErr?.code === '53300') {
      return NextResponse.json(
        {
          success: false,
          error: 'Hệ thống đang bận (quá nhiều kết nối DB). Vui lòng thử lại sau vài giây.',
          code: 'DB_CONNECTION_LIMIT',
        },
        { status: 503 },
      );
    }
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch registrations' }, { status: 500 });
  }
}

// ─── POST: Đăng ký thi → tạo results record ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await insertExamRegistration(pool, body as Record<string, unknown>);
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          ...(result.result_id != null ? { result_id: result.result_id } : {}),
        },
        { status: result.httpStatus }
      );
    }
    return NextResponse.json(
      { success: true, data: result.data, message: 'Đăng ký thi thành công' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating registration:', error);
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
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

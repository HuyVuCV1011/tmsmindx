/**
 * exam-assignment-questions/route.ts
 *
 * Flow mới:
 *   - Câu hỏi được phân công dựa trên chuyen_sau_results (result_id) chứ không phải bảng phân công cũ.
 *   - GET  → lấy câu hỏi được phân cho result_id (từ bộ đề đã gán: ma_de trong chuyen_sau_results)
 *   - POST → phân công bộ đề cho result → cập nhật ma_de + tạo câu hỏi trong chuyen_sau_baithi_cauhoi
 *   - PUT  → cập nhật thông tin phân công (ma_de)
 */

import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ─── GET: Lấy câu hỏi theo result_id hoặc email+subject_code ─────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resultId = searchParams.get('result_id');
    const email = searchParams.get('email');
    const subjectCode = searchParams.get('subject_code');
    const scheduleId = searchParams.get('schedule_id');

    if (!resultId && !(email && subjectCode)) {
      return NextResponse.json(
        { success: false, error: 'Cần result_id hoặc (email + subject_code)' },
        { status: 400 }
      );
    }

    // Tìm result
    const resultCond: string[] = [];
    const resultVals: unknown[] = [];
    if (resultId) {
      resultCond.push(`r.id = $${resultVals.length + 1}`);
      resultVals.push(resultId);
    }
    if (email) {
      resultCond.push(`r.email = $${resultVals.length + 1}`);
      resultVals.push(email);
    }
    if (subjectCode) {
      resultCond.push(`mh.ma_mon = $${resultVals.length + 1}`);
      resultVals.push(subjectCode);
    }
    if (scheduleId) {
      resultCond.push(`r.id_lich = $${resultVals.length + 1}`);
      resultVals.push(scheduleId);
    }

    const resultRow = await pool.query(
      `SELECT r.id, r.ma_de, r.id_mon, r.trang_thai, mh.ma_mon, mh.ten_mon, mh.ma_khoi, mh.loai_ky_thi
       FROM chuyen_sau_results r
       JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       WHERE ${resultCond.join(' AND ')}
       LIMIT 1`,
      resultVals
    );

    if (resultRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy kết quả đăng ký' }, { status: 404 });
    }

    const row = resultRow.rows[0];
    const resolvedResultId = row.id;

    if (!row.ma_de) {
      return NextResponse.json({
        success: false,
        error: 'Chưa có bộ đề nào được phân công cho lần thi này',
        result: row,
      }, { status: 404 });
    }

    // Lấy câu hỏi từ bộ đề đã gán
    const questions = await pool.query(
      `SELECT
         cq.id                                              AS question_id,
         bc.id_de                                          AS set_id,
         bd.ma_de                                          AS set_code,
         cq.loai_cau_hoi                                   AS question_type,
         cq.noi_dung_cau_hoi                               AS question_text,
         CASE
           WHEN cq.lua_chon_a IS NOT NULL OR cq.lua_chon_b IS NOT NULL
            OR cq.lua_chon_c IS NOT NULL OR cq.lua_chon_d IS NOT NULL
           THEN jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
           ELSE NULL
         END                                               AS options,
         cq.dap_an_dung                                    AS correct_answer,
         cq.giai_thich                                     AS explanation,
         cq.diem                                           AS points,
         cq.do_kho                                         AS difficulty,
         bc.thu_tu_hien_thi                                AS order_number,
         $1::int                                           AS result_id
       FROM chuyen_sau_bode bd
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_de = bd.id
       JOIN chuyen_sau_cauhoi cq      ON cq.id = bc.id_cau
       WHERE bd.ma_de = $2
       ORDER BY bc.thu_tu_hien_thi ASC`,
      [resolvedResultId, row.ma_de]
    );

    return NextResponse.json({
      success: true,
      result: row,
      data: questions.rows,
      count: questions.rows.length,
    });
  } catch (error) {
    console.error('Error fetching assignment questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assignment questions' }, { status: 500 });
  }
}

// ─── POST: Phân công bộ đề cho result ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { result_id, set_code, set_id } = body;

    if (!result_id) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }
    if (!set_code && !set_id) {
      return NextResponse.json({ success: false, error: 'set_code hoặc set_id là bắt buộc' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Xác định bộ đề
    let resolvedSetCode = set_code;
    if (!resolvedSetCode) {
      const setRow = await client.query('SELECT ma_de FROM chuyen_sau_bode WHERE id = $1', [set_id]);
      if (setRow.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Bộ đề không tồn tại' }, { status: 404 });
      }
      resolvedSetCode = setRow.rows[0].ma_de;
    }

    // Cập nhật ma_de và trạng thái trên results
    const updated = await client.query(
      `UPDATE chuyen_sau_results
       SET ma_de = $1, trang_thai = 'da_phan_cong'
       WHERE id = $2
       RETURNING *`,
      [resolvedSetCode, result_id]
    );

    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Không tìm thấy result' }, { status: 404 });
    }

    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      data: updated.rows[0],
      message: `Đã phân công bộ đề ${resolvedSetCode}`,
    }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign questions' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ─── PUT: Đổi bộ đề cho result ───────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { result_id, set_code } = body;

    if (!result_id || !set_code) {
      return NextResponse.json({ success: false, error: 'result_id và set_code là bắt buộc' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE chuyen_sau_results SET ma_de = $1 WHERE id = $2 AND trang_thai IN ('da_dang_ky', 'da_phan_cong')
       RETURNING *`,
      [set_code, result_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không thể đổi bộ đề - kết quả không tồn tại hoặc đã thi xong.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ success: false, error: 'Failed to update assignment' }, { status: 500 });
  }
}

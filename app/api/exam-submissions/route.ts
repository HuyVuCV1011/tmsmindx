/**
 * exam-submissions/route.ts
 *
 * Flow nộp bài MỚI (schema V60):
 *   1. User nộp answers kèm result_id (đã có trên chuyen_sau_results)
 *   2. Server tính điểm từ chuyen_sau_cauhoi
 *   3. Lưu từng câu vào chuyen_sau_baithi_cauhoi
 *   4. Cập nhật chuyen_sau_results: so_diem, so_cau_dung, tong_cau, trang_thai='da_nop'
 *
 * Không còn dùng: chuyen_sau_phancong, chuyen_sau_dangky, chuyen_sau_submissions (legacy)
 */

import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface AnswerPayload {
  question_id: number | string;
  answer: string | null;
}

// ─── GET: Xem kết quả bài thi ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resultId = searchParams.get('result_id');
    const email = searchParams.get('email');
    const subjectCode = searchParams.get('subject_code');
    const includeAnswers = searchParams.get('include_answers') === 'true';
    const examType = searchParams.get('exam_type');
    const blockCode = searchParams.get('block_code');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (resultId) {
      conditions.push(`r.id = $${values.length + 1}`);
      values.push(resultId);
    }
    if (email) {
      conditions.push(`r.email = $${values.length + 1}`);
      values.push(email);
    }
    if (subjectCode) {
      conditions.push(`mh.ma_mon = $${values.length + 1}`);
      values.push(subjectCode);
    }
    if (examType) {
      conditions.push(`mh.loai_ky_thi = $${values.length + 1}`);
      values.push(examType);
    }
    if (blockCode) {
      conditions.push(`mh.ma_khoi = $${values.length + 1}`);
      values.push(blockCode);
    }
    // Chỉ lấy những bài đã thi
    conditions.push(`r.trang_thai IN ('da_nop', 'dang_thi')`);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         r.id                   AS result_id,
         r.user_id,
         r.firebase_uid,
         r.email,
         r.ho_ten               AS full_name,
         r.ma_de                AS set_code,
         r.so_diem              AS score,
         r.tong_cau             AS total_questions,
         r.so_cau_dung          AS correct_count,
         r.trang_thai           AS status,
         r.thoi_gian_bat_dau    AS started_at,
         r.thoi_gian_nop        AS submitted_at,
         r.tao_luc              AS created_at,
         mh.ma_mon              AS subject_code,
         mh.ten_mon             AS subject_name,
         mh.ma_khoi             AS block_code,
         mh.loai_ky_thi         AS exam_type,
         bd.diem_dat            AS passing_score,
         bd.tong_diem           AS max_score
       FROM chuyen_sau_results r
       JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       LEFT JOIN chuyen_sau_bode bd ON bd.ma_de = r.ma_de
       ${where}
       ORDER BY r.thoi_gian_nop DESC NULLS LAST`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    // Kèm chi tiết từng câu nếu yêu cầu
    if (includeAnswers && resultId) {
      const answers = await pool.query(
        `SELECT
           btc.id,
           btc.id_cau             AS question_id,
           cq.noi_dung_cau_hoi    AS question_text,
           cq.loai_cau_hoi        AS question_type,
           CASE
             WHEN cq.lua_chon_a IS NOT NULL OR cq.lua_chon_b IS NOT NULL
              OR cq.lua_chon_c IS NOT NULL OR cq.lua_chon_d IS NOT NULL
             THEN jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
             ELSE NULL
           END                    AS options,
           cq.dap_an_dung         AS correct_answer,
           cq.giai_thich          AS explanation,
           btc.dap_an_nguoi_dung  AS user_answer,
           btc.la_dung            AS is_correct,
           btc.diem_dat_duoc      AS points_earned,
           cq.diem                AS points_total
         FROM chuyen_sau_baithi_cauhoi btc
         JOIN chuyen_sau_cauhoi cq ON cq.id = btc.id_cau
         WHERE btc.id_ket_qua = $1
         ORDER BY btc.id ASC`,
        [resultId]
      );
      return NextResponse.json({
        success: true,
        data: result.rows[0],
        answers: answers.rows,
        count: answers.rows.length,
      });
    }

    return NextResponse.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 });
  }
}

// ─── POST: Nộp bài ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      result_id,
      email,
      subject_code,
      schedule_id,
      answers = [],      // Array<{ question_id, answer }>
      started_at,
    } = body;

    if (!result_id && !(email && subject_code)) {
      return NextResponse.json(
        { success: false, error: 'Cần result_id hoặc (email + subject_code)' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Tìm result record
    const resultCond: string[] = [];
    const resultVals: unknown[] = [];
    if (result_id) {
      resultCond.push(`r.id = $${resultVals.length + 1}`);
      resultVals.push(result_id);
    }
    if (email) {
      resultCond.push(`r.email = $${resultVals.length + 1}`);
      resultVals.push(email);
    }
    if (subject_code) {
      resultCond.push(`mh.ma_mon = $${resultVals.length + 1}`);
      resultVals.push(subject_code);
    }
    if (schedule_id) {
      resultCond.push(`r.id_lich = $${resultVals.length + 1}`);
      resultVals.push(schedule_id);
    }

    const resultRow = await client.query(
      `SELECT r.id, r.ma_de, r.id_mon, r.trang_thai, r.email, r.ho_ten
       FROM chuyen_sau_results r
       JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       WHERE ${resultCond.join(' AND ')}
         AND r.trang_thai NOT IN ('da_nop')
       LIMIT 1`,
      resultVals
    );

    if (resultRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy kết quả hoặc bài đã được nộp rồi.' },
        { status: 404 }
      );
    }

    const resultRecord = resultRow.rows[0];
    const resolvedResultId = resultRecord.id;

    if (!resultRecord.ma_de) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Chưa có bộ đề nào được phân công.' },
        { status: 400 }
      );
    }

    // Lấy câu hỏi từ bộ đề
    const questionsResult = await client.query(
      `SELECT cq.id, cq.dap_an_dung, cq.loai_cau_hoi, cq.diem
       FROM chuyen_sau_bode bd
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_de = bd.id
       JOIN chuyen_sau_cauhoi cq      ON cq.id = bc.id_cau
       WHERE bd.ma_de = $1`,
      [resultRecord.ma_de]
    );

    const questionMap = new Map(
      questionsResult.rows.map((q) => [String(q.id), q])
    );

    // Tính điểm
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    const submittedAnswers: AnswerPayload[] = Array.isArray(answers) ? answers : [];
    const processedAnswers: Array<{
      id_ket_qua: number;
      id_cau: number;
      dap_an_nguoi_dung: string | null;
      la_dung: boolean;
      diem_dat_duoc: number;
    }> = [];

    for (const ans of submittedAnswers) {
      const q = questionMap.get(String(ans.question_id));
      if (!q) continue;

      const userAnswer = ans.answer ?? null;
      const points = Number(q.diem || 1);
      totalPoints += points;

      let isCorrect = false;
      if (q.loai_cau_hoi !== 'tu_luan' && userAnswer !== null && q.dap_an_dung) {
        isCorrect = userAnswer.trim().toUpperCase() === q.dap_an_dung.trim().toUpperCase();
      }

      if (isCorrect) {
        correctCount++;
        earnedPoints += points;
      }

      processedAnswers.push({
        id_ket_qua: resolvedResultId,
        id_cau: Number(ans.question_id),
        dap_an_nguoi_dung: userAnswer,
        la_dung: isCorrect,
        diem_dat_duoc: isCorrect ? points : 0,
      });
    }

    // Chuyển đổi điểm sang thang 10
    const totalQuestions = questionsResult.rows.length;
    const score10 = totalPoints > 0
      ? Number(((earnedPoints / totalPoints) * 10).toFixed(2))
      : 0;

    // Xóa câu trả lời cũ nếu có (idempotent)
    await client.query('DELETE FROM chuyen_sau_baithi_cauhoi WHERE id_ket_qua = $1', [resolvedResultId]);

    // Insert câu trả lời mới
    if (processedAnswers.length > 0) {
      const insertQuery = `
        INSERT INTO chuyen_sau_baithi_cauhoi (id_ket_qua, id_cau, dap_an_nguoi_dung, la_dung, diem_dat_duoc)
        VALUES ${processedAnswers.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
      `;
      const insertValues = processedAnswers.flatMap((a) => [
        a.id_ket_qua, a.id_cau, a.dap_an_nguoi_dung, a.la_dung, a.diem_dat_duoc,
      ]);
      await client.query(insertQuery, insertValues);
    }

    // Cập nhật kết quả
    const updatedResult = await client.query(
      `UPDATE chuyen_sau_results SET
         trang_thai          = 'da_nop',
         so_diem             = $1,
         tong_cau            = $2,
         so_cau_dung         = $3,
         thoi_gian_bat_dau   = COALESCE(thoi_gian_bat_dau, $4),
         thoi_gian_nop       = NOW()
       WHERE id = $5
       RETURNING *`,
      [score10, totalQuestions, correctCount, started_at || null, resolvedResultId]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Nộp bài thành công',
      result: updatedResult.rows[0],
      summary: {
        result_id: resolvedResultId,
        score: score10,
        total_questions: totalQuestions,
        correct_count: correctCount,
        incorrect_count: totalQuestions - correctCount,
        earned_points: earnedPoints,
        total_points: totalPoints,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting exam:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit exam' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ─── PUT: Cập nhật trạng thái (admin) ────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { result_id, status, score, notes } = body;

    if (!result_id) {
      return NextResponse.json({ success: false, error: 'result_id is required' }, { status: 400 });
    }

    const clauses: string[] = [];
    const values: unknown[] = [];

    if (status) {
      clauses.push(`trang_thai = $${values.length + 1}`);
      values.push(status);
    }
    if (score !== undefined) {
      clauses.push(`so_diem = $${values.length + 1}`);
      values.push(Number(score));
    }
    if (notes !== undefined) {
      clauses.push(`ghi_chu = $${values.length + 1}`);
      values.push(notes);
    }

    if (clauses.length === 0) {
      return NextResponse.json({ success: false, error: 'Không có gì cần cập nhật' }, { status: 400 });
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
    console.error('Error updating submission:', error);
    return NextResponse.json({ success: false, error: 'Failed to update submission' }, { status: 500 });
  }
}

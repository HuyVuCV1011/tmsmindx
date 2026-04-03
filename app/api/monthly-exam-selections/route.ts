import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: Lấy bộ đề được chọn cho tháng/năm của 1 subject
// Query params: subject_id, year?, month?
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject_id');
    const year = searchParams.get('year') ?? new Date().getFullYear().toString();
    const month = searchParams.get('month') ?? String(new Date().getMonth() + 1);

    if (!subjectId) {
      return NextResponse.json(
        { success: false, error: 'subject_id is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        mes.id,
        mes.subject_id,
        mes.year,
        mes.month,
        mes.selection_mode,
        mes.note,
        mes.created_by,
        mes.created_at,
        mes.updated_at,
        es.id       AS set_id,
        es.set_code,
        es.set_name,
        COALESCE(qc.question_count, 0) AS question_count,
        es.total_points,
        es.passing_score,
        es.status   AS set_status
      FROM monthly_exam_selections mes
      LEFT JOIN exam_sets es ON es.id = mes.selected_set_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS question_count
        FROM exam_set_questions esq
        WHERE esq.set_id = es.id
      ) qc ON TRUE
      WHERE mes.subject_id = $1
        AND mes.year  = $2
        AND mes.month = $3
      LIMIT 1
      `,
      [subjectId, Number(year), Number(month)]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0] ?? null,
    });
  } catch (error: any) {
    console.error('Error fetching monthly exam selection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch selection' },
      { status: 500 }
    );
  }
}

// POST: Admin chọn bộ đề cụ thể (Mặc định)
// Body: { subject_id, year, month, selected_set_id, note? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject_id, year, month, selected_set_id, note, created_by } = body;

    if (!subject_id || !selected_set_id) {
      return NextResponse.json(
        { success: false, error: 'subject_id và selected_set_id là bắt buộc' },
        { status: 400 }
      );
    }

    const targetYear = year ?? new Date().getFullYear();
    const targetMonth = month ?? (new Date().getMonth() + 1);

    // Verify set belongs to this subject
    const setCheck = await pool.query(
      `SELECT
         es.id,
         (SELECT COUNT(*)::int FROM exam_set_questions esq WHERE esq.set_id = es.id) AS question_count
       FROM exam_sets es
       JOIN exam_subject_catalog esc ON esc.id = es.subject_id
       WHERE es.id = $1 AND esc.id = $2`,
      [selected_set_id, subject_id]
    );

    if (setCheck.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Bộ đề không thuộc môn này' },
        { status: 400 }
      );
    }

    const questionCount = Number(setCheck.rows[0]?.question_count || 0);
    if (questionCount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Bộ đề chưa có câu hỏi, không thể dùng để phân công' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      INSERT INTO monthly_exam_selections
        (subject_id, year, month, selected_set_id, selection_mode, note, created_by, updated_at)
      VALUES ($1, $2, $3, $4, 'manual', $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (subject_id, year, month)
      DO UPDATE SET
        selected_set_id = EXCLUDED.selected_set_id,
        selection_mode  = 'manual',
        note            = EXCLUDED.note,
        created_by      = EXCLUDED.created_by,
        updated_at      = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [subject_id, targetYear, targetMonth, selected_set_id, note ?? null, created_by ?? null]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error setting manual selection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save selection' },
      { status: 500 }
    );
  }
}

// PATCH: Tự động chọn ngẫu nhiên (Ngẫu nhiên)
// Body: { subject_id, year?, month? }
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject_id, year, month, created_by } = body;

    if (!subject_id) {
      return NextResponse.json(
        { success: false, error: 'subject_id là bắt buộc' },
        { status: 400 }
      );
    }

    const targetYear = year ?? new Date().getFullYear();
    const targetMonth = month ?? (new Date().getMonth() + 1);

    // Pick a random set from this subject, but only sets that already have questions.
    const randomResult = await pool.query(
      `
      SELECT es.id, es.set_code, es.set_name
      FROM exam_sets es
      WHERE es.subject_id = $1
        AND EXISTS (
          SELECT 1
          FROM exam_set_questions esq
          WHERE esq.set_id = es.id
        )
      ORDER BY RANDOM()
      LIMIT 1
      `,
      [subject_id]
    );

    if (randomResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có bộ đề nào có câu hỏi để chọn ngẫu nhiên' },
        { status: 422 }
      );
    }

    const picked = randomResult.rows[0];

    const result = await pool.query(
      `
      INSERT INTO monthly_exam_selections
        (subject_id, year, month, selected_set_id, selection_mode, note, created_by, updated_at)
      VALUES ($1, $2, $3, $4, 'random', NULL, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (subject_id, year, month)
      DO UPDATE SET
        selected_set_id = EXCLUDED.selected_set_id,
        selection_mode  = 'random',
        note            = NULL,
        created_by      = EXCLUDED.created_by,
        updated_at      = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [subject_id, targetYear, targetMonth, picked.id, created_by ?? null]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      picked: {
        id: picked.id,
        set_code: picked.set_code,
        set_name: picked.set_name,
      },
    });
  } catch (error: any) {
    console.error('Error random-selecting exam set:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to random-select' },
      { status: 500 }
    );
  }
}

// DELETE: Xóa lựa chọn bộ đề của tháng
// Query params: subject_id, year?, month?
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject_id');
    const year = Number(searchParams.get('year') ?? new Date().getFullYear());
    const month = Number(searchParams.get('month') ?? (new Date().getMonth() + 1));

    if (!subjectId) {
      return NextResponse.json(
        { success: false, error: 'subject_id is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      DELETE FROM monthly_exam_selections
      WHERE subject_id = $1
        AND year = $2
        AND month = $3
      RETURNING id
      `,
      [Number(subjectId), year, month]
    );

    return NextResponse.json({
      success: true,
      deleted: (result.rowCount ?? 0) > 0,
    });
  } catch (error: any) {
    console.error('Error deleting monthly exam selection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete selection' },
      { status: 500 }
    );
  }
}

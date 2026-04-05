import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

let subjectConfigColumnsEnsured = false;

async function ensureSubjectConfigColumns() {
  if (subjectConfigColumnsEnsured) return;

  await pool.query(`
    ALTER TABLE IF EXISTS chuyen_sau_monhoc
      ADD COLUMN IF NOT EXISTS exam_duration_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS set_selection_mode VARCHAR(20) NOT NULL DEFAULT 'default',
      ADD COLUMN IF NOT EXISTS default_set_id BIGINT;
  `);

  subjectConfigColumnsEnsured = true;
}

// Subject-driven set selection config.
// Query params accepted for compatibility: subject_id, year?, month?
export async function GET(request: NextRequest) {
  try {
    await ensureSubjectConfigColumns();

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
      SELECT
        csm.id AS subject_id,
        $2::int AS year,
        $3::int AS month,
        csm.set_selection_mode AS selection_mode,
        CASE WHEN csm.set_selection_mode = 'random' THEN 'random' ELSE 'manual' END AS setup_source,
        CASE WHEN csm.set_selection_mode = 'random' THEN 'fallback_random' ELSE 'locked' END AS lock_mode,
        NULL::text AS random_seed,
        NULL::int AS set_question_count_snapshot,
        NULL::text AS selected_by,
        NULL::timestamp AS selected_at,
        NULL::text AS note,
        NULL::text AS created_by,
        csm.created_at,
        csm.updated_at,
        es.id AS set_id,
        es.set_code,
        COALESCE(es.set_note, es.set_name) AS set_name,
        COALESCE(qc.question_count, 0) AS question_count,
        COALESCE(es.total_points, es.target_scale) AS total_points,
        es.passing_score,
        es.status AS set_status
      FROM chuyen_sau_monhoc csm
      LEFT JOIN chuyen_sau_bode es ON es.id = csm.default_set_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS question_count
        FROM chuyen_sau_bode_cauhoi map
        WHERE map.set_id = es.id
      ) qc ON TRUE
      WHERE csm.id = $1
      LIMIT 1
      `,
      [Number(subjectId), year, month]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0] ?? null,
    });
  } catch (error: any) {
    console.error('Error fetching subject set selection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch selection' },
      { status: 500 }
    );
  }
}

// POST: Set default set on subject (default mode)
// Body: { subject_id, year, month, selected_set_id, note? }
export async function POST(request: NextRequest) {
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const { subject_id, selected_set_id } = body;

    if (!subject_id || !selected_set_id) {
      return NextResponse.json(
        { success: false, error: 'subject_id va selected_set_id la bat buoc' },
        { status: 400 }
      );
    }

    // Verify set belongs to subject and has questions.
    const setCheck = await pool.query(
      `SELECT
         es.id,
         (SELECT COUNT(*)::int FROM chuyen_sau_bode_cauhoi map WHERE map.set_id = es.id) AS question_count
       FROM chuyen_sau_bode es
       JOIN chuyen_sau_monhoc esc ON esc.id = es.subject_id
       WHERE es.id = $1 AND esc.id = $2`,
      [selected_set_id, subject_id]
    );

    if (setCheck.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Bo de khong thuoc mon nay' },
        { status: 400 }
      );
    }

    const questionCount = Number(setCheck.rows[0]?.question_count || 0);
    if (questionCount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Bo de chua co cau hoi, khong the dung de phan cong' },
        { status: 400 }
      );
    }

    await pool.query(
      `
      UPDATE chuyen_sau_monhoc
      SET default_set_id = $1,
          set_selection_mode = 'default',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
      `,
      [selected_set_id, subject_id]
    );

    return NextResponse.json({ success: true, subject_id, selected_set_id, question_count: questionCount });
  } catch (error: any) {
    console.error('Error setting manual selection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save selection' },
      { status: 500 }
    );
  }
}

// PATCH: Pick random set and save as subject selection in random mode
// Body: { subject_id, year?, month? }
export async function PATCH(request: NextRequest) {
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const { subject_id } = body;

    if (!subject_id) {
      return NextResponse.json(
        { success: false, error: 'subject_id la bat buoc' },
        { status: 400 }
      );
    }

    // Pick random set from this subject (must have questions).
    const randomResult = await pool.query(
      `
      SELECT es.id, es.set_code, COALESCE(es.set_note, es.set_name) AS set_name
      FROM chuyen_sau_bode es
      WHERE es.subject_id = $1
        AND es.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi map
          WHERE map.set_id = es.id
        )
      ORDER BY RANDOM()
      LIMIT 1
      `,
      [subject_id]
    );

    if (randomResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Khong co bo de nao co cau hoi de chon ngau nhien' },
        { status: 422 }
      );
    }

    const picked = randomResult.rows[0];

    await pool.query(
      `
      UPDATE chuyen_sau_monhoc
      SET default_set_id = $1,
          set_selection_mode = 'random',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
      `,
      [picked.id, subject_id]
    );

    return NextResponse.json({
      success: true,
      data: { subject_id, selected_set_id: picked.id, selection_mode: 'random' },
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

// DELETE: Clear subject default set config
// Query params: subject_id, year?, month?
export async function DELETE(request: NextRequest) {
  try {
    await ensureSubjectConfigColumns();

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject_id');

    if (!subjectId) {
      return NextResponse.json(
        { success: false, error: 'subject_id is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      UPDATE chuyen_sau_monhoc
      SET default_set_id = NULL,
          set_selection_mode = 'default',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
      `,
      [Number(subjectId)]
    );

    return NextResponse.json({
      success: true,
      deleted: (result.rowCount ?? 0) > 0,
    });
  } catch (error: any) {
    console.error('Error deleting subject set selection:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete selection' },
      { status: 500 }
    );
  }
}

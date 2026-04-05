import { ensureChuyenSauExamTables } from '@/lib/chuyen-sau-exam-schema';
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

  await pool.query(`
    UPDATE chuyen_sau_monhoc
    SET exam_duration_minutes = COALESCE(
      exam_duration_minutes,
      CASE
        WHEN COALESCE(metadata->>'duration_minutes', '') ~ '^[0-9]+$' THEN (metadata->>'duration_minutes')::int
        ELSE NULL
      END,
      CASE WHEN exam_type = 'experience' THEN 60 ELSE 120 END
    )
    WHERE exam_duration_minutes IS NULL;
  `);

  subjectConfigColumnsEnsured = true;
}

function normalizeText(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim();
}

function buildSetPrefix(blockCode: string, subjectCode: string) {
  const blockMap: Record<string, string> = {
    CODING: 'COD',
    ROBOTICS: 'ROB',
    ART: 'ART',
    PROCESS: 'PRC',
  };

  const blockPrefix = blockMap[blockCode] || blockCode.slice(0, 3).toUpperCase();

  const normalized = normalizeText(subjectCode);
  const words = normalized.split(/\s+/).filter(Boolean);
  const subjectPrefix = words.length > 0
    ? words[0].slice(0, 3).toUpperCase()
    : 'GEN';

  return `${blockPrefix}-${subjectPrefix}`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureSubjectConfigColumns();
    await ensureChuyenSauExamTables();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const examType = searchParams.get('exam_type');
    const blockCode = searchParams.get('block_code');
    const subjectCode = searchParams.get('subject_code');
    const subjectKey = searchParams.get('subject_key');

    const conditions: string[] = [];
    const values: any[] = [];

    if (id) {
      conditions.push(`es.id = $${values.length + 1}`);
      values.push(id);
    }

    if (examType) {
      conditions.push(`esc.exam_type = $${values.length + 1}`);
      values.push(examType);
    }

    if (blockCode) {
      conditions.push(`esc.block_code = $${values.length + 1}`);
      values.push(blockCode);
    }

    if (subjectCode) {
      conditions.push(`esc.subject_code = $${values.length + 1}`);
      values.push(subjectCode);
    }

    if (subjectKey) {
      conditions.push(`COALESCE(esc.subject_key, esc.metadata->>'subject_key', '') = $${values.length + 1}`);
      values.push(subjectKey);
    }

    let query = `
      SELECT
        es.id,
        es.subject_id,
        COALESCE(esc.subject_key, esc.metadata->>'subject_key') AS subject_key,
        es.set_code,
        COALESCE(es.set_note, es.set_name) AS set_name,
        es.set_note,
        COALESCE(qc.question_count, 0) AS question_count,
        COALESCE(es.total_points, es.target_scale) AS total_points,
        es.passing_score,
        es.min_questions_required,
        COALESCE(es.scoring_mode, es.metadata->>'scoring_mode', 'raw_10') AS scoring_mode,
        COALESCE(es.random_weight, (es.metadata->>'random_weight')::int, 1) AS random_weight,
        COALESCE(es.setup_note, es.metadata->>'setup_note') AS setup_note,
        es.status,
        COALESCE(es.valid_from, (es.metadata->>'valid_from')::timestamp) AS valid_from,
        COALESCE(es.valid_to, (es.metadata->>'valid_to')::timestamp) AS valid_to,
        COALESCE(es.archived_at, (es.metadata->>'archived_at')::timestamp) AS archived_at,
        es.created_at,
        es.updated_at,
        esc.exam_type,
        esc.block_code,
        esc.subject_code,
        esc.subject_name
      FROM chuyen_sau_bode es
      JOIN chuyen_sau_monhoc esc ON esc.id = es.subject_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS question_count
        FROM chuyen_sau_bode_cauhoi csbc
        WHERE csbc.set_id = es.id
      ) qc ON TRUE
    `;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY esc.block_code ASC, esc.subject_code ASC, es.created_at DESC`;

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam sets:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exam sets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const {
      exam_type,
      block_code,
      subject_key,
      subject_code,
      subject_name,
      set_code,
      set_name,
      total_points,
      passing_score,
      min_questions_required,
      scoring_mode,
      random_weight,
      setup_note,
      status,
      valid_from,
      valid_to,
    } = body;

    if (!exam_type || !block_code || !subject_code || !subject_name || !set_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    const normalizedSubjectKey =
      typeof subject_key === 'string' && subject_key.trim()
        ? subject_key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
        : null;

    const subjectQuery = `
      INSERT INTO chuyen_sau_monhoc (exam_type, block_code, subject_code, subject_name, is_active, subject_key, exam_duration_minutes, set_selection_mode, metadata)
      VALUES (
        $1,
        $2,
        $3,
        $4,
        TRUE,
        $5::varchar,
        CASE WHEN $1 = 'experience' THEN 60 ELSE 120 END,
        'default',
        CASE WHEN $5::varchar IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('subject_key', $5::varchar) END
      )
      ON CONFLICT (exam_type, block_code, subject_code)
      DO UPDATE SET
        subject_name = EXCLUDED.subject_name,
        is_active = TRUE,
        subject_key = COALESCE(EXCLUDED.subject_key, chuyen_sau_monhoc.subject_key),
        exam_duration_minutes = COALESCE(chuyen_sau_monhoc.exam_duration_minutes, EXCLUDED.exam_duration_minutes),
        metadata = CASE
          WHEN $5::varchar IS NULL THEN chuyen_sau_monhoc.metadata
          ELSE COALESCE(chuyen_sau_monhoc.metadata, '{}'::jsonb) || jsonb_build_object('subject_key', $5::varchar)
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const subjectResult = await client.query(subjectQuery, [
      exam_type,
      block_code,
      subject_code,
      subject_name,
      normalizedSubjectKey,
    ]);

    const subjectId = subjectResult.rows[0].id;

    let finalSetCode = (set_code || '').trim();

    if (!finalSetCode) {
      const prefix = buildSetPrefix(block_code, subject_code);
      const nextSeqQuery = `
        SELECT COALESCE(MAX((regexp_match(set_code, '-(\\d+)$'))[1]::int), 0) + 1 AS next_seq
        FROM chuyen_sau_bode
        WHERE subject_id = $1
          AND set_code ~ $2
      `;
      const pattern = `^${prefix}-\\d+$`;
      const nextSeqResult = await client.query(nextSeqQuery, [subjectId, pattern]);
      const nextSeq = Number(nextSeqResult.rows[0]?.next_seq || 1);
      finalSetCode = `${prefix}-${String(nextSeq).padStart(2, '0')}`;
    }

    const setQuery = `
      INSERT INTO chuyen_sau_bode (
        subject_id,
        set_code,
        set_name,
        set_note,
        total_points,
        target_scale,
        passing_score,
        min_questions_required,
        status,
        scoring_mode,
        random_weight,
        setup_note,
        valid_from,
        valid_to,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (set_code)
      DO UPDATE SET
        subject_id = EXCLUDED.subject_id,
        set_name = EXCLUDED.set_name,
        set_note = EXCLUDED.set_note,
        total_points = EXCLUDED.total_points,
        target_scale = EXCLUDED.target_scale,
        passing_score = EXCLUDED.passing_score,
        min_questions_required = EXCLUDED.min_questions_required,
        status = EXCLUDED.status,
        scoring_mode = EXCLUDED.scoring_mode,
        random_weight = EXCLUDED.random_weight,
        setup_note = EXCLUDED.setup_note,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const normalizedTotalPoints = 10;
    const isProcessSet = block_code === 'PROCESS' || exam_type === 'experience';
    const normalizedPassingScore = isProcessSet
      ? null
      : Math.min(10, Math.max(0, Number(passing_score || 7)));
    const normalizedScoringMode =
      typeof scoring_mode === 'string' && ['raw_10', 'scaled_10', 'weighted'].includes(scoring_mode)
        ? scoring_mode
        : 'raw_10';
    const normalizedRandomWeight = Math.max(1, Number(random_weight || 1));

    const setResult = await client.query(setQuery, [
      subjectId,
      finalSetCode,
      set_name,
      set_name,
      normalizedTotalPoints,
      normalizedTotalPoints,
      normalizedPassingScore,
      Math.max(1, Number(min_questions_required || 1)),
      status || 'active',
      normalizedScoringMode,
      normalizedRandomWeight,
      setup_note || null,
      valid_from || null,
      valid_to || null,
      JSON.stringify({
        set_note: set_name,
        scoring_mode: normalizedScoringMode,
        random_weight: normalizedRandomWeight,
        setup_note: setup_note || null,
        valid_from: valid_from || null,
        valid_to: valid_to || null,
      }),
    ]);

    // Subject-level policy owns the active default set. If not set yet, use the first created set.
    await client.query(
      `UPDATE chuyen_sau_monhoc
       SET default_set_id = COALESCE(default_set_id, $1),
           set_selection_mode = COALESCE(set_selection_mode, 'default'),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [setResult.rows[0].id, subjectId]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: setResult.rows[0],
      message: 'Exam set saved successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error saving exam set:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save exam set' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const {
      id,
      set_name,
      total_points,
      passing_score,
      min_questions_required,
      scoring_mode,
      random_weight,
      setup_note,
      status,
      valid_from,
      valid_to,
      archived_at,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (typeof set_name === 'string') {
      updates.push(`set_name = $${values.length + 1}`);
      values.push(set_name.trim());
      updates.push(`set_note = $${values.length + 1}`);
      values.push(set_name.trim());
    }

    if (total_points !== undefined) {
      updates.push(`total_points = $${values.length + 1}`);
      values.push(10);
      updates.push(`target_scale = $${values.length + 1}`);
      values.push(10);
    }

    if (passing_score !== undefined) {
      updates.push(`passing_score = $${values.length + 1}`);
      values.push(
        passing_score === null || passing_score === ''
          ? null
          : Math.min(10, Math.max(0, Number(passing_score)))
      );
    }

    if (min_questions_required !== undefined) {
      updates.push(`min_questions_required = $${values.length + 1}`);
      values.push(Math.max(1, Number(min_questions_required)));
    }

    if (scoring_mode !== undefined) {
      updates.push(`scoring_mode = $${values.length + 1}`);
      values.push(scoring_mode);
    }

    if (random_weight !== undefined) {
      updates.push(`random_weight = $${values.length + 1}`);
      values.push(Math.max(1, Number(random_weight)));
    }

    if (setup_note !== undefined) {
      updates.push(`setup_note = $${values.length + 1}`);
      values.push(setup_note || null);
    }

    if (valid_from !== undefined) {
      updates.push(`valid_from = $${values.length + 1}`);
      values.push(valid_from || null);
    }

    if (valid_to !== undefined) {
      updates.push(`valid_to = $${values.length + 1}`);
      values.push(valid_to || null);
    }

    if (archived_at !== undefined) {
      updates.push(`archived_at = $${values.length + 1}`);
      values.push(archived_at || null);
    }

    const metadataPatch: Record<string, unknown> = {};
    if (scoring_mode !== undefined) metadataPatch.scoring_mode = scoring_mode;
    if (random_weight !== undefined) metadataPatch.random_weight = Math.max(1, Number(random_weight));
    if (setup_note !== undefined) metadataPatch.setup_note = setup_note || null;
    if (valid_from !== undefined) metadataPatch.valid_from = valid_from || null;
    if (valid_to !== undefined) metadataPatch.valid_to = valid_to || null;
    if (archived_at !== undefined) metadataPatch.archived_at = archived_at || null;

    if (Object.keys(metadataPatch).length > 0) {
      updates.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${values.length + 1}::jsonb`);
      values.push(JSON.stringify(metadataPatch));
    }

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'status must be active or inactive' },
          { status: 400 }
        );
      }
      updates.push(`status = $${values.length + 1}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await pool.query(
      `
      UPDATE chuyen_sau_bode
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Exam set not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Exam set updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating exam set:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update exam set' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const client = await pool.connect();

  try {
    await ensureSubjectConfigColumns();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'set id is required' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    const assignedResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM chuyen_sau_phancong WHERE selected_set_id = $1',
      [id]
    );

    const assignedCount = Number(assignedResult.rows[0]?.count || 0);
    if (assignedCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        {
          success: false,
          error: 'Bộ đề đã được gán cho giáo viên, không thể xóa.',
          details: `Có ${assignedCount} bản ghi phân công đang tham chiếu bộ đề này.`,
        },
        { status: 409 }
      );
    }

    const deleteResult = await client.query(
      'DELETE FROM chuyen_sau_bode WHERE id = $1 RETURNING id, set_code, COALESCE(set_note, set_name) AS set_name, set_note',
      [id]
    );

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy bộ đề để xóa' },
        { status: 404 }
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Đã xóa bộ đề thành công',
      data: deleteResult.rows[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting exam set:', error);

    if (error?.code === '23503') {
      return NextResponse.json(
        { success: false, error: 'Bộ đề đang được sử dụng nên không thể xóa.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete exam set' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

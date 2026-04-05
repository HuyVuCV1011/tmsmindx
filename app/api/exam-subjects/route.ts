import pool from '@/lib/db';
import { NextResponse } from 'next/server';

type BlockCode = 'CODING' | 'ROBOTICS' | 'ART' | 'PROCESS';

const ALLOWED_BLOCK_CODES: BlockCode[] = ['CODING', 'ROBOTICS', 'ART', 'PROCESS'];

const normalizeSubjectKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getSubjectPrefix = (blockCode: BlockCode) => {
  if (blockCode === 'CODING') return 'cod';
  if (blockCode === 'ROBOTICS') return 'rob';
  if (blockCode === 'ART') return 'art';
  return 'process';
};

const inferExamType = (blockCode: BlockCode) => (blockCode === 'PROCESS' ? 'experience' : 'expertise');

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

  await pool.query(`
    ALTER TABLE IF EXISTS chuyen_sau_monhoc
      ALTER COLUMN exam_duration_minutes SET NOT NULL;
  `);

  subjectConfigColumnsEnsured = true;
}

export async function GET() {
  try {
    await ensureSubjectConfigColumns();

    const result = await pool.query(
      `SELECT
         csm.id,
         csm.exam_type,
         csm.block_code,
         csm.subject_code,
         csm.subject_name,
         csm.subject_key,
         csm.exam_duration_minutes AS duration_minutes,
         csm.set_selection_mode,
         csm.default_set_id,
         ds.set_code AS default_set_code,
         COALESCE(ds.set_note, ds.set_name) AS default_set_name,
         csm.metadata,
         csm.is_active,
         csm.created_at,
         csm.updated_at
       FROM chuyen_sau_monhoc csm
       LEFT JOIN chuyen_sau_bode ds ON ds.id = csm.default_set_id
       WHERE csm.is_active = TRUE
       ORDER BY csm.block_code ASC, csm.subject_name ASC`
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam subjects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exam subjects' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const subjectName = String(body?.subject_name || '').trim();
    const inputBlockCode = String(body?.block_code || 'CODING').toUpperCase() as BlockCode;

    if (!subjectName) {
      return NextResponse.json(
        { success: false, error: 'Tên môn là bắt buộc' },
        { status: 400 }
      );
    }

    if (!ALLOWED_BLOCK_CODES.includes(inputBlockCode)) {
      return NextResponse.json(
        { success: false, error: 'Khối môn không hợp lệ' },
        { status: 400 }
      );
    }

    const prefix = getSubjectPrefix(inputBlockCode);
    const normalizedBase = normalizeSubjectKey(subjectName) || 'mon_hoc';
    const subjectKey = `${prefix}_${normalizedBase}`;
    const examType = inferExamType(inputBlockCode);
    const inputDurationMinutes = Number(body?.duration_minutes);
    const defaultDurationMinutes = inputBlockCode === 'PROCESS' ? 60 : 120;
    const durationMinutes = Number.isFinite(inputDurationMinutes) && inputDurationMinutes > 0
      ? Math.min(1440, Math.floor(inputDurationMinutes))
      : defaultDurationMinutes;

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id
       FROM chuyen_sau_monhoc
       WHERE (subject_key = $1)
          OR (block_code = $2 AND lower(subject_name) = lower($3))
       LIMIT 1`,
      [subjectKey, inputBlockCode, subjectName]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Môn học đã tồn tại trong hệ thống' },
        { status: 409 }
      );
    }

    const displayOrderResult = await client.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
       FROM chuyen_sau_monhoc
       WHERE block_code = $1`,
      [inputBlockCode]
    );
    const displayOrder = Number(displayOrderResult.rows[0]?.next_order || 1);

    const insertResult = await client.query(
      `INSERT INTO chuyen_sau_monhoc (
         exam_type,
         block_code,
         subject_code,
         subject_name,
         subject_key,
         exam_duration_minutes,
         set_selection_mode,
         display_order,
         is_active,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'default', $7, TRUE, $8::jsonb)
       RETURNING
         id,
         exam_type,
         block_code,
         subject_code,
         subject_name,
         subject_key,
         exam_duration_minutes AS duration_minutes,
         set_selection_mode,
         default_set_id,
         metadata,
         is_active,
         created_at,
         updated_at`,
      [
        examType,
        inputBlockCode,
        subjectName,
        subjectName,
        subjectKey,
        durationMinutes,
        displayOrder,
        JSON.stringify({ created_source: 'thu_vien_de_manual', duration_minutes: durationMinutes }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: insertResult.rows[0],
    });
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors to preserve original error handling.
    }
    console.error('Error creating exam subject:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create exam subject' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSubjectConfigColumns();

    const body = await request.json();
    const subjectId = Number(body?.id);
    const hasDuration = body?.duration_minutes !== undefined;
    const hasSelectionMode = body?.set_selection_mode !== undefined;
    const hasDefaultSet = body?.default_set_id !== undefined;
    const inputDurationMinutes = Number(body?.duration_minutes);
    const inputSelectionMode = String(body?.set_selection_mode || '').trim().toLowerCase();
    const defaultSetId = body?.default_set_id === null || body?.default_set_id === ''
      ? null
      : Number(body?.default_set_id);

    if (!Number.isFinite(subjectId) || subjectId <= 0) {
      return NextResponse.json(
        { success: false, error: 'id bộ môn không hợp lệ' },
        { status: 400 }
      );
    }

    if (!hasDuration && !hasSelectionMode && !hasDefaultSet) {
      return NextResponse.json(
        { success: false, error: 'Không có dữ liệu cần cập nhật' },
        { status: 400 }
      );
    }

    if (hasDuration && (!Number.isFinite(inputDurationMinutes) || inputDurationMinutes <= 0)) {
      return NextResponse.json(
        { success: false, error: 'duration_minutes phải lớn hơn 0' },
        { status: 400 }
      );
    }

    if (hasSelectionMode && !['default', 'random'].includes(inputSelectionMode)) {
      return NextResponse.json(
        { success: false, error: 'set_selection_mode chỉ chấp nhận default hoặc random' },
        { status: 400 }
      );
    }

    if (hasDefaultSet && defaultSetId !== null && (!Number.isFinite(defaultSetId) || defaultSetId <= 0)) {
      return NextResponse.json(
        { success: false, error: 'default_set_id không hợp lệ' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: Array<number | string | null> = [];

    if (hasDuration) {
      const durationMinutes = Math.min(1440, Math.floor(inputDurationMinutes));
      updates.push(`exam_duration_minutes = $${values.length + 1}`);
      values.push(durationMinutes);
    }

    if (hasSelectionMode) {
      updates.push(`set_selection_mode = $${values.length + 1}`);
      values.push(inputSelectionMode);
    }

    if (hasDefaultSet) {
      if (defaultSetId !== null) {
        const setBelongsResult = await pool.query(
          `SELECT 1
           FROM chuyen_sau_bode
           WHERE id = $1
             AND subject_id = $2
           LIMIT 1`,
          [defaultSetId, subjectId]
        );

        if (setBelongsResult.rowCount === 0) {
          return NextResponse.json(
            { success: false, error: 'Bộ đề mặc định không thuộc bộ môn này' },
            { status: 400 }
          );
        }
      }

      updates.push(`default_set_id = $${values.length + 1}`);
      values.push(defaultSetId);
    }

    updates.push(`metadata = COALESCE(metadata, '{}'::jsonb)`);

    const result = await pool.query(
      `UPDATE chuyen_sau_monhoc
       SET ${updates.join(', ')},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length + 1}
       RETURNING
         id,
         exam_type,
         block_code,
         subject_code,
         subject_name,
         subject_key,
         exam_duration_minutes AS duration_minutes,
         set_selection_mode,
         default_set_id,
         metadata,
         is_active,
         created_at,
         updated_at`,
      [...values, subjectId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy bộ môn' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating exam subject:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update exam subject' },
      { status: 500 }
    );
  }
}

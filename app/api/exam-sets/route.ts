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
      CASE WHEN COALESCE(exam_type, loai_ky_thi) = 'experience' THEN 60 ELSE 120 END
    )
    WHERE exam_duration_minutes IS NULL;
  `);

  // Backfill default_set_id từ bộ đề active đầu tiên của môn học.
  await pool.query(`
    UPDATE chuyen_sau_monhoc csm
    SET default_set_id = (
      SELECT csb.id
      FROM chuyen_sau_bode csb
      WHERE csb.id_mon = csm.id
        AND csb.trang_thai = 'active'
      ORDER BY csb.tao_luc ASC
      LIMIT 1
    )
    WHERE csm.default_set_id IS NULL
      AND EXISTS (
        SELECT 1 FROM chuyen_sau_bode csb
        WHERE csb.id_mon = csm.id AND csb.trang_thai = 'active'
      );
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
      conditions.push(`COALESCE(esc.exam_type, esc.loai_ky_thi) = $${values.length + 1}`);
      values.push(examType);
    }

    if (blockCode) {
      conditions.push(`esc.ma_khoi = $${values.length + 1}`);
      values.push(blockCode);
    }

    if (subjectCode) {
      conditions.push(`esc.ma_mon = $${values.length + 1}`);
      values.push(subjectCode);
    }

    if (subjectKey) {
      conditions.push(`COALESCE(esc.khoa_mon, esc.metadata->>'subject_key', '') = $${values.length + 1}`);
      values.push(subjectKey);
    }

    let query = `
      SELECT
        es.id,
        es.id_mon AS subject_id,
        COALESCE(esc.khoa_mon, esc.metadata->>'subject_key') AS subject_key,
        es.ma_de AS set_code,
        es.ten_de AS set_name,
        es.ten_de AS set_note,
        COALESCE(qc.question_count, 0) AS question_count,
        es.tong_diem AS total_points,
        es.diem_dat AS passing_score,
        COALESCE(es.che_do_tinh_diem, 'raw_10') AS scoring_mode,
        COALESCE(es.trong_so_ngau_nhien, 1) AS random_weight,
        es.trang_thai AS status,
        es.tao_luc AS created_at,
        COALESCE(esc.exam_type, esc.loai_ky_thi) AS exam_type,
        esc.ma_khoi AS block_code,
        esc.ma_mon AS subject_code,
        esc.ten_mon AS subject_name,
        esc.default_set_id
      FROM chuyen_sau_bode es
      JOIN chuyen_sau_monhoc esc ON esc.id = es.id_mon
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS question_count
        FROM chuyen_sau_bode_cauhoi csbc
        WHERE csbc.id_de = es.id
      ) qc ON TRUE
    `;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY esc.ma_khoi ASC, esc.ma_mon ASC, es.tao_luc DESC`;

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

    // Tính duration trong JS để tránh dùng $1 trong CASE WHEN (gây lỗi type inference)
    const defaultDuration = exam_type === 'experience' ? 60 : 120;
    const metadataValue = normalizedSubjectKey
      ? JSON.stringify({ subject_key: normalizedSubjectKey })
      : '{}';

    const subjectQuery = `
      INSERT INTO chuyen_sau_monhoc (loai_ky_thi, ma_khoi, ma_mon, ten_mon, dang_hoat_dong, khoa_mon, exam_duration_minutes, set_selection_mode, metadata)
      VALUES ($1, $2, $3, $4, TRUE, $5, $6, 'default', $7::jsonb)
      ON CONFLICT (ma_mon)
      DO UPDATE SET
        ten_mon = EXCLUDED.ten_mon,
        dang_hoat_dong = TRUE,
        khoa_mon = COALESCE(EXCLUDED.khoa_mon, chuyen_sau_monhoc.khoa_mon),
        exam_duration_minutes = COALESCE(chuyen_sau_monhoc.exam_duration_minutes, EXCLUDED.exam_duration_minutes),
        metadata = COALESCE(chuyen_sau_monhoc.metadata, '{}'::jsonb) || EXCLUDED.metadata
      RETURNING id
    `;

    const subjectResult = await client.query(subjectQuery, [
      exam_type,        // $1 loai_ky_thi
      block_code,       // $2 ma_khoi
      subject_code,     // $3 ma_mon (unique constraint)
      subject_name,     // $4 ten_mon
      normalizedSubjectKey, // $5 khoa_mon
      defaultDuration,  // $6 exam_duration_minutes
      metadataValue,    // $7 metadata
    ]);

    const subjectId = subjectResult.rows[0].id;

    let finalSetCode = (set_code || '').trim();

    if (!finalSetCode) {
      const prefix = buildSetPrefix(block_code, subject_code);
      const nextSeqQuery = `
        SELECT COALESCE(MAX((regexp_match(ma_de, '-(\\d+)$'))[1]::int), 0) + 1 AS next_seq
        FROM chuyen_sau_bode
        WHERE id_mon = $1
          AND ma_de ~ $2
      `;
      const pattern = `^${prefix}-\\d+$`;
      const nextSeqResult = await client.query(nextSeqQuery, [subjectId, pattern]);
      const nextSeq = Number(nextSeqResult.rows[0]?.next_seq || 1);
      finalSetCode = `${prefix}-${String(nextSeq).padStart(2, '0')}`;
    }

    const setQuery = `
      INSERT INTO chuyen_sau_bode (
        id_mon,
        ma_de,
        ten_de,
        tong_diem,
        diem_dat,
        trang_thai,
        che_do_tinh_diem,
        trong_so_ngau_nhien
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (ma_de)
      DO UPDATE SET
        id_mon = EXCLUDED.id_mon,
        ten_de = EXCLUDED.ten_de,
        tong_diem = EXCLUDED.tong_diem,
        diem_dat = EXCLUDED.diem_dat,
        trang_thai = EXCLUDED.trang_thai,
        che_do_tinh_diem = EXCLUDED.che_do_tinh_diem,
        trong_so_ngau_nhien = EXCLUDED.trong_so_ngau_nhien
      RETURNING id, ma_de AS set_code, ten_de AS set_name, tong_diem AS total_points,
                diem_dat AS passing_score, trang_thai AS status,
                che_do_tinh_diem AS scoring_mode, trong_so_ngau_nhien AS random_weight,
                tao_luc AS created_at
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
      normalizedTotalPoints,
      normalizedPassingScore,
      status || 'active',
      normalizedScoringMode,
      normalizedRandomWeight,
    ]);

    // Subject-level policy owns the active default set. If not set yet, use the first created set.
    await client.query(
      `UPDATE chuyen_sau_monhoc
       SET default_set_id = COALESCE(default_set_id, $1),
           set_selection_mode = COALESCE(set_selection_mode, 'default')
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
      updates.push(`ten_de = $${values.length + 1}`);
      values.push(set_name.trim());
    }

    if (total_points !== undefined) {
      updates.push(`tong_diem = $${values.length + 1}`);
      values.push(10);
    }

    if (passing_score !== undefined) {
      updates.push(`diem_dat = $${values.length + 1}`);
      values.push(
        passing_score === null || passing_score === ''
          ? null
          : Math.min(10, Math.max(0, Number(passing_score)))
      );
    }

    if (scoring_mode !== undefined) {
      updates.push(`che_do_tinh_diem = $${values.length + 1}`);
      values.push(scoring_mode);
    }

    if (random_weight !== undefined) {
      updates.push(`trong_so_ngau_nhien = $${values.length + 1}`);
      values.push(Math.max(1, Number(random_weight)));
    }

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'status must be active or inactive' },
          { status: 400 }
        );
      }
      updates.push(`trang_thai = $${values.length + 1}`);
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
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, ma_de AS set_code, ten_de AS set_name, tong_diem AS total_points,
                diem_dat AS passing_score, trang_thai AS status,
                che_do_tinh_diem AS scoring_mode, trong_so_ngau_nhien AS random_weight,
                tao_luc AS created_at
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
      'DELETE FROM chuyen_sau_bode WHERE id = $1 RETURNING id, ma_de AS set_code, ten_de AS set_name, ten_de AS set_note',
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

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const examType = searchParams.get('exam_type');
    const blockCode = searchParams.get('block_code');
    const subjectCode = searchParams.get('subject_code');

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

    let query = `
      SELECT
        es.id,
        es.subject_id,
        es.set_code,
        es.set_name,
        COALESCE(qc.question_count, 0) AS question_count,
        es.total_points,
        es.passing_score,
        es.status,
        es.valid_from,
        es.valid_to,
        es.created_at,
        es.updated_at,
        esc.exam_type,
        esc.block_code,
        esc.subject_code,
        esc.subject_name
      FROM exam_sets es
      JOIN exam_subject_catalog esc ON esc.id = es.subject_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS question_count
        FROM exam_set_questions esq
        WHERE esq.set_id = es.id
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
    const DEFAULT_EXAM_SET_DURATION_MINUTES = 45;

    const body = await request.json();
    const {
      exam_type,
      block_code,
      subject_code,
      subject_name,
      set_code,
      set_name,
      total_points,
      passing_score,
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

    const subjectQuery = `
      INSERT INTO exam_subject_catalog (exam_type, block_code, subject_code, subject_name, is_active)
      VALUES ($1::exam_type_enum, $2, $3, $4, TRUE)
      ON CONFLICT (exam_type, block_code, subject_code)
      DO UPDATE SET
        subject_name = EXCLUDED.subject_name,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const subjectResult = await client.query(subjectQuery, [
      exam_type,
      block_code,
      subject_code,
      subject_name,
    ]);

    const subjectId = subjectResult.rows[0].id;

    let finalSetCode = (set_code || '').trim();

    if (!finalSetCode) {
      const prefix = buildSetPrefix(block_code, subject_code);
      const nextSeqQuery = `
        SELECT COALESCE(MAX((regexp_match(set_code, '-(\\d+)$'))[1]::int), 0) + 1 AS next_seq
        FROM exam_sets
        WHERE subject_id = $1
          AND set_code ~ $2
      `;
      const pattern = `^${prefix}-\\d+$`;
      const nextSeqResult = await client.query(nextSeqQuery, [subjectId, pattern]);
      const nextSeq = Number(nextSeqResult.rows[0]?.next_seq || 1);
      finalSetCode = `${prefix}-${String(nextSeq).padStart(2, '0')}`;
    }

    const setQuery = `
      INSERT INTO exam_sets (
        subject_id,
        set_code,
        set_name,
        duration_minutes,
        total_points,
        passing_score,
        status,
        valid_from,
        valid_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (subject_id, set_code)
      DO UPDATE SET
        set_name = EXCLUDED.set_name,
        total_points = EXCLUDED.total_points,
        passing_score = EXCLUDED.passing_score,
        status = EXCLUDED.status,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const setResult = await client.query(setQuery, [
      subjectId,
      finalSetCode,
      set_name,
      DEFAULT_EXAM_SET_DURATION_MINUTES,
      Number(total_points || 10),
      Number(passing_score || 7),
      status || 'active',
      valid_from || null,
      valid_to || null,
    ]);

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
    const body = await request.json();
    const { id, set_name, total_points, passing_score, status, valid_from, valid_to } = body;

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
    }

    if (total_points !== undefined) {
      updates.push(`total_points = $${values.length + 1}`);
      values.push(Number(total_points));
    }

    if (passing_score !== undefined) {
      updates.push(`passing_score = $${values.length + 1}`);
      values.push(Number(passing_score));
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

    if (valid_from !== undefined) {
      updates.push(`valid_from = $${values.length + 1}`);
      values.push(valid_from || null);
    }

    if (valid_to !== undefined) {
      updates.push(`valid_to = $${values.length + 1}`);
      values.push(valid_to || null);
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
      UPDATE exam_sets
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
      'SELECT COUNT(*)::int AS count FROM teacher_exam_assignments WHERE selected_set_id = $1',
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
      'DELETE FROM exam_sets WHERE id = $1 RETURNING id, set_code, set_name',
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

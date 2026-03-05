import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureAssignmentsFromRegistrations(teacherCodes: string[]) {
  if (!teacherCodes.length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
      WITH missing AS (
        SELECT
          er.id AS registration_id,
          er.teacher_code,
          er.exam_type,
          er.registration_type,
          er.block_code,
          er.subject_code,
          er.scheduled_at
        FROM exam_registrations er
        LEFT JOIN teacher_exam_assignments tea ON tea.registration_id = er.id
        WHERE tea.id IS NULL
          AND LOWER(TRIM(er.teacher_code)) = ANY($1::text[])
      ),
      resolved AS (
        SELECT
          m.*,
          set_pick.id AS set_id
        FROM missing m
        LEFT JOIN LATERAL (
          SELECT es.id
          FROM exam_sets es
          JOIN exam_subject_catalog esc ON esc.id = es.subject_id
          WHERE esc.exam_type = m.exam_type
            AND esc.block_code = m.block_code
            AND esc.subject_code = m.subject_code
            AND es.status = 'active'
            AND (es.valid_from IS NULL OR m.scheduled_at >= es.valid_from)
            AND (es.valid_to IS NULL OR m.scheduled_at <= es.valid_to)
          ORDER BY RANDOM()
          LIMIT 1
        ) set_pick ON TRUE
      ),
      inserted AS (
        INSERT INTO teacher_exam_assignments (
          registration_id,
          teacher_code,
          exam_type,
          registration_type,
          block_code,
          subject_code,
          selected_set_id,
          random_seed,
          random_assigned_at,
          open_at,
          close_at,
          assignment_status,
          score,
          score_status,
          expired_at
        )
        SELECT
          r.registration_id,
          r.teacher_code,
          r.exam_type,
          r.registration_type,
          r.block_code,
          r.subject_code,
          r.set_id,
          NULL,
          CURRENT_TIMESTAMP,
          r.scheduled_at,
          r.scheduled_at + INTERVAL '45 minutes',
          'assigned',
          NULL,
          'null',
          NULL
        FROM resolved r
        WHERE r.set_id IS NOT NULL
        RETURNING id, registration_id
      )
      INSERT INTO exam_assignment_events (
        assignment_id,
        event_type,
        actor_type,
        actor_code,
        payload
      )
      SELECT
        i.id,
        'assigned',
        'system',
        NULL,
        jsonb_build_object(
          'registration_id', i.registration_id,
          'source', 'exam-assignments-backfill'
        )
      FROM inserted i
      `,
      [teacherCodes]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code');
    const teacherCodesRaw = searchParams.get('teacher_codes');
    const month = searchParams.get('month');

    if (!teacherCode) {
      return NextResponse.json(
        { success: false, error: 'teacher_code is required' },
        { status: 400 }
      );
    }

    let query = `
      SELECT
        tea.id,
        tea.teacher_code,
        tea.exam_type,
        tea.registration_type,
        tea.block_code,
        tea.subject_code,
        tea.open_at,
        tea.close_at,
        tea.assignment_status,
        tea.score,
        tea.score_status,
        tea.selected_set_id,
        tea.created_at,
        tea.updated_at,
        es.set_code,
        es.set_name,
        es.total_points,
        es.passing_score,
        ex.status AS explanation_status
      FROM teacher_exam_assignments tea
      LEFT JOIN exam_sets es ON es.id = tea.selected_set_id
      LEFT JOIN exam_explanations ex ON ex.assignment_id = tea.id
      WHERE TRUE
    `;

    const values: any[] = [];

    const teacherCodes = (teacherCodesRaw || '')
      .split(',')
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean);

    await ensureAssignmentsFromRegistrations(
      teacherCodes.length > 0 ? teacherCodes : [teacherCode.trim().toLowerCase()]
    );

    if (teacherCodes.length > 0) {
      values.push(teacherCodes);
      query += `
        AND LOWER(TRIM(tea.teacher_code)) = ANY($${values.length}::text[])
      `;
    } else {
      values.push(teacherCode.trim().toLowerCase());
      query += `
        AND LOWER(TRIM(tea.teacher_code)) = $${values.length}
      `;
    }

    if (month) {
      values.push(month);
      query += `
        AND TO_CHAR(tea.open_at, 'YYYY-MM') = $${values.length}
      `;
    }

    query += `
      ORDER BY tea.open_at DESC, tea.created_at DESC
    `;

    const result = await pool.query(query, values);

    const now = new Date();
    const mapped = result.rows.map((row) => {
      const openAt = new Date(row.open_at);
      const closeAt = new Date(row.close_at);
      const isOpen = now >= openAt && now <= closeAt;
      const canTake = isOpen && ['assigned', 'in_progress'].includes(row.assignment_status);

      return {
        ...row,
        is_open: isOpen,
        can_take: canTake,
      };
    });

    return NextResponse.json({
      success: true,
      data: mapped,
      count: mapped.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exam assignments' },
      { status: 500 }
    );
  }
}

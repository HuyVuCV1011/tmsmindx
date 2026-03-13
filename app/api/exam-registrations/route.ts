import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code');
    const month = searchParams.get('month');

    let query = `
      SELECT
        er.id,
        er.teacher_code,
        er.exam_type,
        er.registration_type,
        er.block_code,
        er.subject_code,
        esc.subject_name,
        COALESCE(er.center_code, tts.center) AS center_code,
        er.scheduled_at,
        er.source_form,
        er.created_at,
        er.updated_at,
        tea.id AS assignment_id,
        tea.assignment_status,
        tea.score,
        tea.score_status,
        tea.open_at,
        tea.close_at,
        tea.selected_set_id,
        tea.random_assigned_at,
        es.set_code,
        es.set_name,
        es.total_points,
        es.passing_score
      FROM exam_registrations er
      LEFT JOIN exam_subject_catalog esc
        ON esc.exam_type = er.exam_type
        AND esc.block_code = er.block_code
        AND esc.subject_code = er.subject_code
      LEFT JOIN teacher_exam_assignments tea
        ON tea.registration_id = er.id
      LEFT JOIN exam_sets es
        ON es.id = tea.selected_set_id
      LEFT JOIN training_teacher_stats tts
        ON LOWER(TRIM(tts.teacher_code)) = LOWER(TRIM(er.teacher_code))
      WHERE TRUE
    `;

    const values: any[] = [];

    if (teacherCode) {
      values.push(teacherCode.trim().toLowerCase());
      query += `
        AND LOWER(TRIM(er.teacher_code)) = $${values.length}
      `;
    }

    if (month) {
      values.push(month);
      query += `
        AND TO_CHAR(er.scheduled_at, 'YYYY-MM') = $${values.length}
      `;
    }

    query += `
      ORDER BY er.created_at DESC, er.id DESC
    `;

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam registrations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exam registrations' },
      { status: 500 }
    );
  }
});

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      teacher_code,
      exam_type,
      registration_type,
      block_code,
      subject_code,
      center_code,
      scheduled_at,
      source_form,
      open_at,
      close_at,
      random_seed,
    } = body;

    if (!teacher_code || !exam_type || !registration_type || !block_code || !subject_code || !scheduled_at) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const scheduledAt = new Date(scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid scheduled_at' },
        { status: 400 }
      );
    }

    const openAt = open_at ? new Date(open_at) : scheduledAt;
    const closeAt = close_at
      ? new Date(close_at)
      : new Date(scheduledAt.getTime() + 45 * 60 * 1000);

    if (Number.isNaN(openAt.getTime()) || Number.isNaN(closeAt.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid open_at/close_at' },
        { status: 400 }
      );
    }

    const sourceForm = source_form || (registration_type === 'additional' ? 'additional_form' : 'main_form');

    let finalCenterCode = (center_code || '').toString().trim();
    if (!finalCenterCode) {
      const centerLookup = await pool.query(
        `
        SELECT center
        FROM training_teacher_stats
        WHERE LOWER(TRIM(teacher_code)) = LOWER(TRIM($1))
        LIMIT 1
        `,
        [teacher_code]
      );
      finalCenterCode = (centerLookup.rows[0]?.center || '').toString().trim();
    }

    const query = `
      SELECT *
      FROM assign_random_set_on_registration(
        $1::varchar,
        $2::exam_type_enum,
        $3::registration_type_enum,
        $4::varchar,
        $5::varchar,
        $6::varchar,
        $7::timestamp,
        $8::varchar,
        $9::timestamp,
        $10::timestamp,
        $11::varchar
      )
    `;

    const values = [
      teacher_code,
      exam_type,
      registration_type,
      block_code,
      subject_code,
      finalCenterCode || null,
      scheduledAt,
      sourceForm,
      openAt,
      closeAt,
      random_seed || null,
    ];

    const result = await pool.query(query, values);

    if (!result.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Cannot create registration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Registration created and set assigned successfully',
    });
  } catch (error: any) {
    console.error('Error creating exam registration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create registration' },
      { status: 500 }
    );
  }
});

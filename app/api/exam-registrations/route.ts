import { withApiProtection } from '@/lib/api-protection';
import { ensureChuyenSauExamTables } from '@/lib/chuyen-sau-exam-schema';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function ensureRegistrationSchema(client?: { query: (text: string) => Promise<any> }) {
  const db = client ?? pool;
  await db.query(`
    ALTER TABLE chuyen_sau_dangky
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS registration_type VARCHAR(30),
      ADD COLUMN IF NOT EXISTS source_form VARCHAR(50),
      ADD COLUMN IF NOT EXISTS center_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS event_schedule_id UUID;
  `);
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    await ensureRegistrationSchema();
    await ensureChuyenSauExamTables();

    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code');
    const month = searchParams.get('month');

    const eventScheduleColumnCheck = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chuyen_sau_dangky'
          AND column_name = 'event_schedule_id'
      ) AS exists
      `
    );
    const hasEventScheduleIdColumn = Boolean(eventScheduleColumnCheck.rows[0]?.exists);
    const scheduledEventIdSelect = hasEventScheduleIdColumn
      ? `
        CASE
          WHEN csd.event_schedule_id IS NOT NULL THEN csd.event_schedule_id::text
          WHEN csd.registration_note IS NOT NULL AND csd.registration_note LIKE '{%'
            THEN NULLIF(csd.registration_note::jsonb ->> 'scheduled_event_id', '')
          ELSE NULL
        END AS scheduled_event_id,
      `
      : `
        CASE
          WHEN csd.registration_note IS NOT NULL AND csd.registration_note LIKE '{%'
            THEN NULLIF(csd.registration_note::jsonb ->> 'scheduled_event_id', '')
          ELSE NULL
        END AS scheduled_event_id,
      `;

    let query = `
      SELECT
        csd.id,
        csd.teacher_code,
        csd.exam_type,
        CASE
          WHEN csd.registration_note IS NOT NULL AND csd.registration_note LIKE '{%'
            THEN COALESCE(csd.registration_note::jsonb ->> 'registration_type', 'main')
          ELSE 'main'
        END AS registration_type,
        csd.block_code,
        csd.subject_code,
        csm.subject_name,
        COALESCE(csd.teacher_name, tts.full_name) AS teacher_name,
        COALESCE(csd.campus, tts.center) AS center_code,
        COALESCE(tea.open_at, make_timestamp(csd.year, csd.month, 1, 0, 0, 0)) AS scheduled_at,
        CASE
          WHEN csd.registration_note IS NOT NULL AND csd.registration_note LIKE '{%'
            THEN COALESCE(csd.registration_note::jsonb ->> 'source_form', 'main_form')
          ELSE 'main_form'
        END AS source_form,
        ${scheduledEventIdSelect}
        csd.created_at,
        csd.updated_at,
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
      FROM chuyen_sau_dangky csd
      LEFT JOIN chuyen_sau_monhoc csm
        ON csm.exam_type = csd.exam_type
        AND csm.block_code = csd.block_code
        AND csm.subject_code = csd.subject_code
      LEFT JOIN chuyen_sau_phancong tea
        ON tea.registration_id = csd.id
      LEFT JOIN chuyen_sau_bode es
        ON es.id = tea.selected_set_id
      LEFT JOIN training_teacher_stats tts
        ON LOWER(TRIM(tts.teacher_code)) = LOWER(TRIM(csd.teacher_code))
      WHERE TRUE
    `;

    const values: any[] = [];

    if (teacherCode) {
      values.push(teacherCode.trim().toLowerCase());
      query += `
        AND LOWER(TRIM(csd.teacher_code)) = $${values.length}
      `;
    }

    if (month) {
      values.push(month);
      query += `
        AND (csd.year::text || '-' || LPAD(csd.month::text, 2, '0')) = $${values.length}
      `;
    }

    query += `
      ORDER BY csd.created_at DESC, csd.id DESC
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
  const client = await pool.connect();
  try {
    await ensureRegistrationSchema(client);
    await ensureChuyenSauExamTables(client);

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
      scheduled_event_id,
      random_seed,
      teacher_info,
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

    const requestedOpenAt = open_at ? new Date(open_at) : scheduledAt;

    if (Number.isNaN(requestedOpenAt.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid open_at' },
        { status: 400 }
      );
    }

    const sourceForm = source_form || (registration_type === 'additional' ? 'additional_form' : 'main_form');
    const normalizedRegistrationType =
      registration_type === 'additional' ? 'additional' : 'official';
    const normalizedEventScheduleId =
      typeof scheduled_event_id === 'string' && scheduled_event_id.trim().length > 0
        ? scheduled_event_id.trim()
        : null;

    const eventScheduleColumnCheck = await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chuyen_sau_dangky'
          AND column_name = 'event_schedule_id'
      ) AS exists
      `
    );
    const hasEventScheduleIdColumn = Boolean(eventScheduleColumnCheck.rows[0]?.exists);

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

    await client.query('BEGIN');

    const subjectConfigRes = await client.query(
      `
      SELECT
        csm.id,
        csm.set_selection_mode,
        csm.default_set_id,
        csm.exam_duration_minutes
      FROM chuyen_sau_monhoc csm
      WHERE csm.exam_type = $1::text
        AND csm.block_code = $2
        AND csm.subject_code = $3
        AND csm.is_active = TRUE
      LIMIT 1
      `,
      [exam_type, block_code, subject_code]
    );

    if (!subjectConfigRes.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Khong tim thay cau hinh mon hoc dang active' },
        { status: 400 }
      );
    }

    const subjectConfig = subjectConfigRes.rows[0] as {
      id: number;
      default_set_id: number | null;
      exam_duration_minutes: number | null;
    };

    if (!subjectConfig.default_set_id) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Mon hoc chua cau hinh default_set_id' },
        { status: 422 }
      );
    }

    const defaultSetRes = await client.query(
      `
      SELECT es.id
      FROM chuyen_sau_bode es
      WHERE es.id = $1
        AND es.subject_id = $2
        AND es.status = 'active'
        AND (es.valid_from IS NULL OR $3::timestamp >= es.valid_from)
        AND (es.valid_to IS NULL OR $3::timestamp <= es.valid_to)
        AND EXISTS (
          SELECT 1 FROM chuyen_sau_bode_cauhoi map WHERE map.set_id = es.id
        )
      LIMIT 1
      `,
      [subjectConfig.default_set_id, subjectConfig.id, scheduledAt]
    );

    const selectedSetRow = (defaultSetRes.rows[0] as { id: number } | undefined) || null;

    if (!selectedSetRow) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Khong co bo de hop le (active + co cau hoi) cho mon hoc nay' },
        { status: 422 }
      );
    }

    const subjectDuration = Number(subjectConfig.exam_duration_minutes || 0);
    const effectiveDurationMinutes = Math.max(
      1,
      Number.isFinite(subjectDuration) && subjectDuration > 0
        ? subjectDuration
        : 45
    );

    const openAt = requestedOpenAt;
    const closeAt = new Date(openAt.getTime() + effectiveDurationMinutes * 60 * 1000);

    const teacherName =
      (teacher_info?.teacher_name || teacher_info?.full_name || teacher_code || '').toString().trim() ||
      teacher_code;
    const teacherEmail =
      (teacher_info?.email || teacher_info?.work_email || '').toString().trim() ||
      `${teacher_code}@unknown.local`;
    const registrationCampus =
      (finalCenterCode || teacher_info?.campus || '').toString().trim() || null;
    const vnRegistrationDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(scheduledAt);
    const [vnRegistrationYear, vnRegistrationMonth] = vnRegistrationDate.split('-').map(Number);

    const registrationPayload = JSON.stringify({
      registration_type,
      source_form: sourceForm,
      scheduled_at: scheduledAt.toISOString(),
      open_at: requestedOpenAt.toISOString(),
      close_at: closeAt.toISOString(),
      scheduled_event_id: normalizedEventScheduleId,
      random_seed: random_seed || null,
    });

    const existingRegistration = normalizedEventScheduleId
      ? hasEventScheduleIdColumn
        ? await client.query(
            `
            SELECT id
            FROM chuyen_sau_dangky
            WHERE LOWER(TRIM(teacher_code)) = LOWER(TRIM($1))
              AND exam_type = $2
              AND block_code = $3
              AND subject_code = $4
              AND event_schedule_id = $5::uuid
            LIMIT 1
            `,
            [teacher_code, exam_type, block_code, subject_code, normalizedEventScheduleId]
          )
        : await client.query(
            `
            SELECT id
            FROM chuyen_sau_dangky
            WHERE LOWER(TRIM(teacher_code)) = LOWER(TRIM($1))
              AND exam_type = $2
              AND block_code = $3
              AND subject_code = $4
              AND registration_note IS NOT NULL
              AND registration_note LIKE '{%'
              AND registration_note::jsonb ->> 'scheduled_event_id' = $5
            LIMIT 1
            `,
            [teacher_code, exam_type, block_code, subject_code, normalizedEventScheduleId]
          )
      : hasEventScheduleIdColumn
        ? await client.query(
            `
            SELECT id
            FROM chuyen_sau_dangky
            WHERE LOWER(TRIM(teacher_code)) = LOWER(TRIM($1))
              AND exam_type = $2
              AND block_code = $3
              AND subject_code = $4
              AND month = $5
              AND year = $6
              AND event_schedule_id IS NULL
            LIMIT 1
            `,
            [teacher_code, exam_type, block_code, subject_code, vnRegistrationMonth, vnRegistrationYear]
          )
        : await client.query(
            `
            SELECT id
            FROM chuyen_sau_dangky
            WHERE LOWER(TRIM(teacher_code)) = LOWER(TRIM($1))
              AND exam_type = $2
              AND block_code = $3
              AND subject_code = $4
              AND month = $5
              AND year = $6
            LIMIT 1
            `,
            [teacher_code, exam_type, block_code, subject_code, vnRegistrationMonth, vnRegistrationYear]
          );

    const registrationInsert = existingRegistration.rows.length > 0
      ? hasEventScheduleIdColumn
        ? await client.query(
            `
            UPDATE chuyen_sau_dangky
            SET teacher_name = $1,
                email = $2,
                campus = $3,
                month = $4,
                year = $5,
                scheduled_at = $6,
                registration_type = $7,
                source_form = $8,
                center_code = $9,
                event_schedule_id = $10::uuid,
                registration_note = $11,
                status = 'registered',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING id
            `,
            [
              teacherName,
              teacherEmail,
              registrationCampus,
              vnRegistrationMonth,
              vnRegistrationYear,
              scheduledAt,
              normalizedRegistrationType,
              sourceForm,
              finalCenterCode || null,
              normalizedEventScheduleId,
              registrationPayload,
              existingRegistration.rows[0].id,
            ]
          )
        : await client.query(
            `
            UPDATE chuyen_sau_dangky
            SET teacher_name = $1,
                email = $2,
                campus = $3,
                month = $4,
                year = $5,
                scheduled_at = $6,
                registration_type = $7,
                source_form = $8,
                center_code = $9,
                registration_note = $10,
                status = 'registered',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11
            RETURNING id
            `,
            [
              teacherName,
              teacherEmail,
              registrationCampus,
              vnRegistrationMonth,
              vnRegistrationYear,
              scheduledAt,
              normalizedRegistrationType,
              sourceForm,
              finalCenterCode || null,
              registrationPayload,
              existingRegistration.rows[0].id,
            ]
          )
      : hasEventScheduleIdColumn
        ? await client.query(
            `
            INSERT INTO chuyen_sau_dangky (
              teacher_name,
              teacher_code,
              email,
              campus,
              exam_type,
              block_code,
              subject_code,
              month,
              year,
              scheduled_at,
              registration_type,
              source_form,
              center_code,
              event_schedule_id,
              registration_note,
              status
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13, $14::uuid, $15, 'registered'
            )
            RETURNING id
            `,
            [
              teacherName,
              teacher_code,
              teacherEmail,
              registrationCampus,
              exam_type,
              block_code,
              subject_code,
              vnRegistrationMonth,
              vnRegistrationYear,
              scheduledAt,
              normalizedRegistrationType,
              sourceForm,
              finalCenterCode || null,
              normalizedEventScheduleId,
              registrationPayload,
            ]
          )
        : await client.query(
            `
            INSERT INTO chuyen_sau_dangky (
              teacher_name,
              teacher_code,
              email,
              campus,
              exam_type,
              block_code,
              subject_code,
              month,
              year,
              scheduled_at,
              registration_type,
              source_form,
              center_code,
              registration_note,
              status
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13, $14, 'registered'
            )
            RETURNING id
            `,
            [
              teacherName,
              teacher_code,
              teacherEmail,
              registrationCampus,
              exam_type,
              block_code,
              subject_code,
              vnRegistrationMonth,
              vnRegistrationYear,
              scheduledAt,
              normalizedRegistrationType,
              sourceForm,
              finalCenterCode || null,
              registrationPayload,
            ]
          );

    const registeredId = Number(registrationInsert.rows[0]?.id || 0);

    const assignmentInsert = await client.query(
      `
      INSERT INTO chuyen_sau_phancong (
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
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, 'assigned', NULL, 'null', NULL
      )
      ON CONFLICT (registration_id)
      DO UPDATE SET
        teacher_code = EXCLUDED.teacher_code,
        exam_type = EXCLUDED.exam_type,
        registration_type = EXCLUDED.registration_type,
        block_code = EXCLUDED.block_code,
        subject_code = EXCLUDED.subject_code,
        selected_set_id = EXCLUDED.selected_set_id,
        random_seed = EXCLUDED.random_seed,
        random_assigned_at = CURRENT_TIMESTAMP,
        open_at = EXCLUDED.open_at,
        close_at = EXCLUDED.close_at,
        assignment_status = 'assigned',
        score = NULL,
        score_status = 'null',
        expired_at = NULL,
        updated_at = NOW()
      RETURNING id
      `,
      [
        registeredId,
        teacher_code,
        exam_type,
        normalizedRegistrationType,
        block_code,
        subject_code,
        selectedSetRow.id,
        random_seed || null,
        openAt,
        closeAt,
      ]
    );

    const assignmentId = Number(assignmentInsert.rows[0]?.id || 0);

    await client.query('COMMIT');

    const registrationResult = {
      registration_id: registeredId,
      assignment_id: assignmentId,
      selected_set_id: selectedSetRow.id,
    };

    const { selected_set_id: registeredSetId } = registrationResult;

    // Auto-fill chuyen_sau_results for chuyên sâu (expertise) exams
    if (exam_type === 'expertise') {
      try {
        const VN_TZ = 'Asia/Ho_Chi_Minh';
        const vnFmt = new Intl.DateTimeFormat('vi-VN', {
          timeZone: VN_TZ,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const thoi_gian_kiem_tra = vnFmt.format(scheduledAt);
        const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ }).format(scheduledAt);
        const [vnYear, vnMonth] = vnDate.split('-').map(Number);

        const hinh_thuc = normalizedRegistrationType === 'additional' ? 'Bổ sung' : 'Chính thức';
        const ho_va_ten = (teacher_info?.teacher_name || '').toString().trim() || null;
        const dia_chi_email = (teacher_info?.email || '').toString().trim() || null;
        const co_so = (teacher_info?.campus || finalCenterCode || '').toString().trim() || null;
        const ma_lms = teacher_code;

        const deValue = registeredSetId != null ? String(registeredSetId) : null;
        await pool.query(
          `INSERT INTO chuyen_sau_results
            (registration_id, assignment_id,
             ho_va_ten, dia_chi_email, bo_mon, co_so, ma_lms, hinh_thuc,
             thang_dk, nam_dk, thoi_gian_kiem_tra, de,
             cau_dung, diem, xu_ly_diem, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               0, 0, 'Mac dinh 0 - can giai trinh neu vang thi', NOW(), NOW())`,
          [registeredId, null, ho_va_ten, dia_chi_email, subject_code, co_so, ma_lms, hinh_thuc,
           vnMonth, vnYear, thoi_gian_kiem_tra, deValue]
        );
      } catch (csrErr: any) {
        // Non-fatal: log but don't fail the registration
        console.error('[exam-registrations] chuyen_sau_results auto-fill failed:', csrErr.message);
      }
    }

    if (assignmentId > 0) {
      try {
        await pool.query(
          `UPDATE chuyen_sau_results
           SET assignment_id = $1,
               registration_id = COALESCE(registration_id, $2),
               updated_at = NOW()
           WHERE registration_id = $2
             AND (assignment_id IS NULL OR assignment_id <> $1)`,
          [assignmentId, registeredId]
        );
      } catch (csrLinkErr: any) {
        console.error('[exam-registrations] failed to link assignment_id to chuyen_sau_results:', csrLinkErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: registrationResult,
      message: 'Registration created and set assigned successfully',
    });
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op
    }
    console.error('Error creating exam registration:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create registration' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
});

export const DELETE = withApiProtection(async (request: NextRequest) => {
  const client = await pool.connect();

  try {
    await ensureChuyenSauExamTables(client);

    const body = await request.json();
    const registrationId = Number(body?.registration_id);

    if (!registrationId || Number.isNaN(registrationId)) {
      return NextResponse.json(
        { success: false, error: 'registration_id không hợp lệ' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    const assignmentResult = await client.query(
      `
      SELECT id, assignment_status
      FROM chuyen_sau_phancong
      WHERE registration_id = $1
      LIMIT 1
      `,
      [registrationId]
    );

    if (!assignmentResult.rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Đăng ký này đã ở trạng thái pending' },
        { status: 400 }
      );
    }

    const assignment = assignmentResult.rows[0] as {
      id: number;
      assignment_status: string;
    };

    if (assignment.assignment_status === 'submitted' || assignment.assignment_status === 'graded') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Không thể đưa về pending vì bài đã nộp/chấm' },
        { status: 400 }
      );
    }

    await client.query(
      `
      DELETE FROM chuyen_sau_phancong
      WHERE id = $1
      `,
      [assignment.id]
    );

    await client.query(
      `
      UPDATE chuyen_sau_dangky
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [registrationId]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Đã đưa đăng ký về trạng thái pending',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error removing exam assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to set registration pending' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
});

import { ensureChuyenSauExamTables } from '@/lib/chuyen-sau-exam-schema';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function resolveAssignmentId(inputAssignmentId: number): Promise<number> {
  if (!Number.isFinite(inputAssignmentId) || inputAssignmentId <= 0) {
    return 0;
  }

  const directRes = await pool.query(
    `SELECT id
     FROM chuyen_sau_phancong
     WHERE id = $1
     LIMIT 1`,
    [inputAssignmentId]
  );

  if (directRes.rowCount) {
    return inputAssignmentId;
  }

  const byRegistrationDirectRes = await pool.query(
    `SELECT cp.id
     FROM chuyen_sau_phancong cp
     WHERE cp.registration_id = $1
     ORDER BY cp.updated_at DESC, cp.created_at DESC
     LIMIT 1`,
    [inputAssignmentId]
  );

  if (byRegistrationDirectRes.rowCount) {
    return Number(byRegistrationDirectRes.rows[0]?.id || 0);
  }

  const legacyRes = await pool.query(
    `SELECT assignment_id, registration_id
     FROM chuyen_sau_results
     WHERE id = $1
     LIMIT 1`,
    [inputAssignmentId]
  );

  const mappedAssignmentId = Number(legacyRes.rows[0]?.assignment_id || 0);
  if (mappedAssignmentId > 0) {
    return mappedAssignmentId;
  }

  const mappedByRegistrationRes = await pool.query(
    `SELECT cp.id
     FROM chuyen_sau_phancong cp
     WHERE cp.registration_id = $1
     ORDER BY cp.updated_at DESC, cp.created_at DESC
     LIMIT 1`,
    [legacyRes.rows[0]?.registration_id || null]
  );

  return Number(mappedByRegistrationRes.rows[0]?.id || 0);
}

async function repairAssignmentSetIfNeeded(assignmentId: number) {
  const quickAssignmentRes = await pool.query(
    `
      SELECT
        tea.*,
        es.set_name,
        es.set_code,
        es.total_points,
        es.passing_score,
        es.status AS set_status,
        es.valid_from,
        es.valid_to,
        (
          SELECT COUNT(*)::int
          FROM chuyen_sau_bode_cauhoi esq
          WHERE esq.set_id = tea.selected_set_id
        ) AS question_count
      FROM chuyen_sau_phancong tea
      JOIN chuyen_sau_bode es ON es.id = tea.selected_set_id
      WHERE tea.id = $1
      LIMIT 1
    `,
    [assignmentId]
  );

  if (!quickAssignmentRes.rows.length) {
    return { assignment: null, questionCount: 0 };
  }

  const quickAssignment = quickAssignmentRes.rows[0];
  const quickQuestionCount = Number(quickAssignment.question_count || 0);
  if (quickQuestionCount > 0) {
    return { assignment: quickAssignment, questionCount: quickQuestionCount };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assignmentRes = await client.query(
      `
      SELECT
        tea.*, 
        es.set_name,
        es.set_code,
        es.total_points,
        es.passing_score,
        es.status AS set_status,
        es.valid_from,
        es.valid_to,
        (
          SELECT COUNT(*)::int
          FROM chuyen_sau_bode_cauhoi esq
          WHERE esq.set_id = tea.selected_set_id
        ) AS question_count
      FROM chuyen_sau_phancong tea
      JOIN chuyen_sau_bode es ON es.id = tea.selected_set_id
      WHERE tea.id = $1
      FOR UPDATE
      `,
      [assignmentId]
    );

    if (!assignmentRes.rows.length) {
      await client.query('ROLLBACK');
      return { assignment: null, questionCount: 0 };
    }

    let assignment = assignmentRes.rows[0];
    let questionCount = Number(assignment.question_count || 0);

    if (questionCount > 0) {
      await client.query('COMMIT');
      return { assignment, questionCount };
    }

    const replacementSetRes = await client.query(
      `
      WITH subject_cfg AS (
        SELECT
          csm.id,
          csm.set_selection_mode,
          csm.default_set_id
        FROM chuyen_sau_monhoc csm
        WHERE csm.exam_type = $2::text
          AND csm.block_code = $3
          AND csm.subject_code = $4
          AND csm.is_active = TRUE
        LIMIT 1
      ),
      default_pick AS (
        SELECT es.id
        FROM chuyen_sau_bode es
        JOIN subject_cfg cfg ON cfg.default_set_id = es.id
          AND es.status = 'active'
          AND (es.valid_from IS NULL OR $1::timestamp >= es.valid_from)
          AND (es.valid_to IS NULL OR $1::timestamp <= es.valid_to)
          AND EXISTS (
            SELECT 1
            FROM chuyen_sau_bode_cauhoi map
            WHERE map.set_id = es.id
          )
        LIMIT 1
      ),
      random_pick AS (
        SELECT es.id
        FROM chuyen_sau_bode es
        JOIN subject_cfg cfg ON cfg.id = es.subject_id
        WHERE es.status = 'active'
          AND (es.valid_from IS NULL OR $1::timestamp >= es.valid_from)
          AND (es.valid_to IS NULL OR $1::timestamp <= es.valid_to)
          AND EXISTS (
            SELECT 1
            FROM chuyen_sau_bode_cauhoi map
            WHERE map.set_id = es.id
          )
        ORDER BY RANDOM()
        LIMIT 1
      )
      SELECT
        CASE
          WHEN (SELECT set_selection_mode FROM subject_cfg) = 'random' THEN (SELECT id FROM random_pick)
          ELSE COALESCE((SELECT id FROM default_pick), (SELECT id FROM random_pick))
        END AS set_id
      `,
      [assignment.open_at, assignment.exam_type, assignment.block_code, assignment.subject_code]
    );

    const replacementSetId = Number(replacementSetRes.rows[0]?.set_id || 0);
    if (!replacementSetId) {
      await client.query('COMMIT');
      return { assignment, questionCount: 0 };
    }

    await client.query(
      `
        UPDATE chuyen_sau_phancong
      SET selected_set_id = $1,
          random_assigned_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [replacementSetId, assignmentId]
    );

    const refreshedRes = await client.query(
      `
      SELECT
        tea.*, 
        es.set_name,
        es.set_code,
        es.total_points,
        es.passing_score,
        es.status AS set_status,
        es.valid_from,
        es.valid_to,
        (
          SELECT COUNT(*)::int
          FROM chuyen_sau_bode_cauhoi esq
          WHERE esq.set_id = tea.selected_set_id
        ) AS question_count
      FROM chuyen_sau_phancong tea
      JOIN chuyen_sau_bode es ON es.id = tea.selected_set_id
      WHERE tea.id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    assignment = refreshedRes.rows[0] || assignment;
    questionCount = Number(assignment.question_count || 0);

    await client.query('COMMIT');
    return { assignment, questionCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureChuyenSauExamTables();

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignment_id');

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'assignment_id is required' },
        { status: 400 }
      );
    }

    const numericAssignmentId = Number(assignmentId);
    if (Number.isNaN(numericAssignmentId)) {
      return NextResponse.json(
        { success: false, error: 'assignment_id is invalid' },
        { status: 400 }
      );
    }

    const resolvedAssignmentId = await resolveAssignmentId(numericAssignmentId);
    if (!resolvedAssignmentId) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const repairResult = await repairAssignmentSetIfNeeded(resolvedAssignmentId);

    if (!repairResult.assignment) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const assignment = repairResult.assignment;
    const now = new Date();
    const openAt = new Date(assignment.open_at);
    const closeAt = new Date(assignment.close_at);
    const validFrom = assignment.valid_from ? new Date(assignment.valid_from) : null;
    const validTo = assignment.valid_to ? new Date(assignment.valid_to) : null;

    const isWithinAssignmentWindow = now >= openAt && now <= closeAt;
    const isWithinSetWindow = (!validFrom || now >= validFrom) && (!validTo || now <= validTo);
    const isSetActiveNow = assignment.set_status === 'active' && isWithinSetWindow;

    if (!isWithinAssignmentWindow) {
      return NextResponse.json(
        { success: false, error: 'Chưa đến hoặc đã hết thời gian làm bài theo lịch kiểm tra' },
        { status: 403 }
      );
    }

    if (!isSetActiveNow) {
      return NextResponse.json(
        { success: false, error: 'Bộ đề hiện không ở trạng thái active trong khung giờ cho phép' },
        { status: 403 }
      );
    }

    const questionsQuery = `
      SELECT
        q.id,
        q.question_text,
        q.question_type,
        ARRAY_REMOVE(ARRAY[q.option_a, q.option_b, q.option_c, q.option_d], NULL) AS options,
        q.correct_answer,
        COALESCE(map.points_override, q.points, 1) AS points,
        map.display_order AS order_number
      FROM chuyen_sau_bode_cauhoi map
      JOIN chuyen_sau_cauhoi q ON q.id = map.question_id
      WHERE map.set_id = $1
      ORDER BY map.display_order ASC, q.id ASC
    `;

    const questionsResult = await pool.query(questionsQuery, [assignment.selected_set_id]);
    const questionCount = questionsResult.rows.length;

    if (questionCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bộ đề hiện tại chưa có câu hỏi. Vui lòng liên hệ admin để cập nhật bộ đề.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      assignment,
      questions: questionsResult.rows,
      count: questionCount,
    });
  } catch (error: any) {
    console.error('Error fetching exam questions:', error);

    if (error?.code === '53300' || String(error?.message || '').toLowerCase().includes('remaining connection slots')) {
      return NextResponse.json(
        {
          success: false,
          error: 'He thong dang qua tai ket noi CSDL. Vui long thu lai sau vai giay.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

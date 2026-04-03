import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function repairAssignmentSetIfNeeded(assignmentId: number) {
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
          FROM exam_set_questions esq
          WHERE esq.set_id = tea.selected_set_id
        ) AS question_count
      FROM teacher_exam_assignments tea
      JOIN exam_sets es ON es.id = tea.selected_set_id
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
      WITH month_pick AS (
        SELECT es.id
        FROM exam_subject_catalog esc
        JOIN monthly_exam_selections mes
          ON mes.subject_id = esc.id
         AND mes.year = EXTRACT(YEAR FROM $1::timestamp)::int
         AND mes.month = EXTRACT(MONTH FROM $1::timestamp)::int
        JOIN exam_sets es ON es.id = mes.selected_set_id
        WHERE esc.exam_type = $2
          AND esc.block_code = $3
          AND esc.subject_code = $4
          AND es.status = 'active'
          AND (es.valid_from IS NULL OR $1::timestamp >= es.valid_from)
          AND (es.valid_to IS NULL OR $1::timestamp <= es.valid_to)
          AND EXISTS (
            SELECT 1
            FROM exam_set_questions esq
            WHERE esq.set_id = es.id
          )
        LIMIT 1
      ),
      random_pick AS (
        SELECT es.id
        FROM exam_sets es
        JOIN exam_subject_catalog esc ON esc.id = es.subject_id
        WHERE esc.exam_type = $2
          AND esc.block_code = $3
          AND esc.subject_code = $4
          AND es.status = 'active'
          AND (es.valid_from IS NULL OR $1::timestamp >= es.valid_from)
          AND (es.valid_to IS NULL OR $1::timestamp <= es.valid_to)
          AND EXISTS (
            SELECT 1
            FROM exam_set_questions esq
            WHERE esq.set_id = es.id
          )
        ORDER BY RANDOM()
        LIMIT 1
      )
      SELECT COALESCE((SELECT id FROM month_pick), (SELECT id FROM random_pick)) AS set_id
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
      UPDATE teacher_exam_assignments
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
          FROM exam_set_questions esq
          WHERE esq.set_id = tea.selected_set_id
        ) AS question_count
      FROM teacher_exam_assignments tea
      JOIN exam_sets es ON es.id = tea.selected_set_id
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

    const repairResult = await repairAssignmentSetIfNeeded(numericAssignmentId);

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
      SELECT id, question_text, question_type, options, correct_answer, points, order_number
      FROM exam_set_questions
      WHERE set_id = $1
      ORDER BY order_number ASC
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
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

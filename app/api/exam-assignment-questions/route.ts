import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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

    const assignmentQuery = `
      SELECT tea.*, es.set_name, es.set_code, es.total_points, es.passing_score, es.status AS set_status, es.valid_from, es.valid_to
      FROM teacher_exam_assignments tea
      JOIN exam_sets es ON es.id = tea.selected_set_id
      WHERE tea.id = $1
      LIMIT 1
    `;

    const assignmentResult = await pool.query(assignmentQuery, [assignmentId]);

    if (!assignmentResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const assignment = assignmentResult.rows[0];
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

    return NextResponse.json({
      success: true,
      assignment,
      questions: questionsResult.rows,
      count: questionsResult.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam questions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

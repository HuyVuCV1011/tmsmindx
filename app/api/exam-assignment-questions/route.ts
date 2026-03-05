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
      SELECT tea.*, es.set_name, es.set_code, es.total_points, es.passing_score
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

    const questionsQuery = `
      SELECT id, question_text, question_type, options, correct_answer, points, order_number
      FROM exam_set_questions
      WHERE set_id = $1
      ORDER BY order_number ASC
    `;

    const questionsResult = await pool.query(questionsQuery, [assignmentResult.rows[0].selected_set_id]);

    return NextResponse.json({
      success: true,
      assignment: assignmentResult.rows[0],
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

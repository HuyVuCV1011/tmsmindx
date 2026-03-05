import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignment_id, teacher_code } = body;

    if (!assignment_id || !teacher_code) {
      return NextResponse.json(
        { success: false, error: 'assignment_id and teacher_code are required' },
        { status: 400 }
      );
    }

    const assignmentQuery = `
      SELECT id, teacher_code, open_at, close_at, assignment_status
      FROM teacher_exam_assignments
      WHERE id = $1
      LIMIT 1
    `;
    const assignmentResult = await pool.query(assignmentQuery, [assignment_id]);

    if (!assignmentResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const assignment = assignmentResult.rows[0];
    if (String(assignment.teacher_code).toLowerCase() !== String(teacher_code).toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized assignment access' },
        { status: 403 }
      );
    }

    const now = new Date();
    if (now < new Date(assignment.open_at)) {
      return NextResponse.json(
        { success: false, error: 'Exam is not open yet' },
        { status: 400 }
      );
    }

    if (now > new Date(assignment.close_at) || assignment.assignment_status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'Exam time is over' },
        { status: 400 }
      );
    }

    const existingQuery = `
      SELECT *
      FROM teacher_exam_submissions
      WHERE assignment_id = $1
      LIMIT 1
    `;
    const existing = await pool.query(existingQuery, [assignment_id]);

    if (existing.rows.length) {
      return NextResponse.json({
        success: true,
        data: existing.rows[0],
      });
    }

    const insertQuery = `
      INSERT INTO teacher_exam_submissions (
        assignment_id,
        teacher_code,
        started_at,
        status
      ) VALUES ($1, $2, NOW(), 'in_progress')
      RETURNING *
    `;

    const insertResult = await pool.query(insertQuery, [assignment_id, teacher_code]);

    await pool.query(
      `UPDATE teacher_exam_assignments SET assignment_status = 'in_progress' WHERE id = $1`,
      [assignment_id]
    );

    return NextResponse.json({
      success: true,
      data: insertResult.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating exam submission:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create exam submission' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignment_id, teacher_code, score, total_points, percentage, is_passed } = body;

    if (!assignment_id || !teacher_code || score === undefined) {
      return NextResponse.json(
        { success: false, error: 'assignment_id, teacher_code and score are required' },
        { status: 400 }
      );
    }

    const now = new Date();

    const submissionQuery = `
      SELECT id, started_at
      FROM teacher_exam_submissions
      WHERE assignment_id = $1 AND LOWER(teacher_code) = LOWER($2)
      LIMIT 1
    `;
    const submissionResult = await pool.query(submissionQuery, [assignment_id, teacher_code]);

    if (!submissionResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    const submission = submissionResult.rows[0];
    const startedAt = submission.started_at ? new Date(submission.started_at) : now;
    const timeSpentSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));

    const updateSubmissionQuery = `
      UPDATE teacher_exam_submissions
      SET
        submitted_at = NOW(),
        time_spent_seconds = $1,
        raw_score = $2,
        percentage = $3,
        is_passed = $4,
        status = 'graded',
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

    const updatedSubmission = await pool.query(updateSubmissionQuery, [
      timeSpentSeconds,
      score,
      percentage,
      is_passed,
      submission.id,
    ]);

    await pool.query(
      `
      UPDATE teacher_exam_assignments
      SET
        assignment_status = 'graded',
        score = $1,
        score_status = 'graded',
        updated_at = NOW()
      WHERE id = $2
      `,
      [score, assignment_id]
    );

    return NextResponse.json({
      success: true,
      data: updatedSubmission.rows[0],
    });
  } catch (error: any) {
    console.error('Error submitting exam:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit exam' },
      { status: 500 }
    );
  }
}

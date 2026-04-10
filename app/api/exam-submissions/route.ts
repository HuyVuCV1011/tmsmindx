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
      SELECT tea.id, tea.teacher_code, tea.open_at, tea.close_at, tea.assignment_status,
             es.status AS set_status, es.valid_from, es.valid_to
      FROM teacher_exam_assignments tea
      JOIN exam_sets es ON es.id = tea.selected_set_id
      WHERE tea.id = $1
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

    const validFrom = assignment.valid_from ? new Date(assignment.valid_from) : null;
    const validTo = assignment.valid_to ? new Date(assignment.valid_to) : null;
    const isWithinSetWindow = (!validFrom || now >= validFrom) && (!validTo || now <= validTo);
    const isSetActiveNow = assignment.set_status === 'active' && isWithinSetWindow;

    if (!isSetActiveNow) {
      return NextResponse.json(
        { success: false, error: 'Bộ đề hiện không active trong thời gian lịch cho phép' },
        { status: 403 }
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
  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      assignment_id,
      teacher_code,
      answers, // array of { question_id, answer_text }
    } = body;

    if (!assignment_id || !teacher_code) {
      return NextResponse.json(
        { success: false, error: 'assignment_id and teacher_code are required' },
        { status: 400 }
      );
    }

    // Verify the assignment belongs to this teacher and is still valid
    const assignmentResult = await client.query(
      `SELECT tea.id, tea.selected_set_id, tea.open_at, tea.close_at, tea.assignment_status,
              es.total_points, es.passing_score
       FROM teacher_exam_assignments tea
       JOIN exam_sets es ON es.id = tea.selected_set_id
       WHERE tea.id = $1 AND LOWER(TRIM(tea.teacher_code)) = LOWER(TRIM($2))
       LIMIT 1`,
      [assignment_id, teacher_code]
    );

    if (!assignmentResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found or unauthorized' },
        { status: 404 }
      );
    }

    const assignment = assignmentResult.rows[0];

    const submissionResult = await client.query(
      `SELECT id, started_at FROM teacher_exam_submissions
       WHERE assignment_id = $1 LIMIT 1`,
      [assignment_id]
    );

    if (!submissionResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    const submission = submissionResult.rows[0];
    const now = new Date();
    const startedAt = submission.started_at ? new Date(submission.started_at) : now;
    const timeSpentSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));

    // Fetch all questions for the set to grade server-side
    const questionsResult = await client.query(
      `SELECT id, correct_answer, points FROM exam_set_questions WHERE set_id = $1`,
      [assignment.selected_set_id]
    );
    const questionMap = new Map(
      questionsResult.rows.map((q: any) => [q.id, q])
    );

    let totalScore = 0;
    const answersToInsert: Array<{ question_id: number; answer_text: string; is_correct: boolean; points_earned: number }> = [];

    // Strip HTML tags, decode entities, and normalize whitespace for comparison
    const normalizeForGrading = (value: string): string => {
      if (!value) return '';
      let text = String(value);
      // Decode HTML entities (handles &lt; &gt; &amp; &quot; &nbsp; etc.)
      text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
      // Strip any remaining HTML tags
      text = text.replace(/<[^>]*>/g, ' ');
      // Collapse whitespace
      text = text.replace(/\s+/g, ' ').trim().toLowerCase();
      return text;
    };

    if (Array.isArray(answers)) {
      for (const ans of answers) {
        const q = questionMap.get(Number(ans.question_id));
        if (!q) continue;
        const correctAnswer = normalizeForGrading(q.correct_answer || '');
        const userAnswer = normalizeForGrading(ans.answer_text || '');
        const isCorrect = correctAnswer !== '' && userAnswer === correctAnswer;
        const pointsEarned = isCorrect ? parseFloat(q.points) : 0;
        totalScore += pointsEarned;
        answersToInsert.push({
          question_id: Number(ans.question_id),
          answer_text: ans.answer_text || '',
          is_correct: isCorrect,
          points_earned: pointsEarned,
        });
      }
    }

    const totalPoints = parseFloat(assignment.total_points);
    const percentage = totalPoints > 0 ? Math.min(100, (totalScore / totalPoints) * 100) : 0;
    const isPassed = totalScore >= parseFloat(assignment.passing_score);

    await client.query('BEGIN');

    // Upsert answers
    for (const ans of answersToInsert) {
      await client.query(
        `INSERT INTO teacher_exam_answers (submission_id, question_id, answer_text, is_correct, points_earned)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (submission_id, question_id)
         DO UPDATE SET answer_text = EXCLUDED.answer_text, is_correct = EXCLUDED.is_correct, points_earned = EXCLUDED.points_earned`,
        [submission.id, ans.question_id, ans.answer_text, ans.is_correct, ans.points_earned]
      );
    }

    const updatedSubmission = await client.query(
      `UPDATE teacher_exam_submissions
       SET submitted_at = NOW(), time_spent_seconds = $1, raw_score = $2,
           percentage = $3, is_passed = $4, status = 'graded', updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [timeSpentSeconds, totalScore, percentage.toFixed(2), isPassed, submission.id]
    );

    await client.query(
      `UPDATE teacher_exam_assignments
       SET assignment_status = 'graded', score = $1, score_status = 'graded', updated_at = NOW()
       WHERE id = $2`,
      [totalScore, assignment_id]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        ...updatedSubmission.rows[0],
        calculated_score: totalScore,
        total_points: totalPoints,
        percentage: parseFloat(percentage.toFixed(2)),
        is_passed: isPassed,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error submitting exam:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit exam' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

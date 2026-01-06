import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: Fetch teacher submissions with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code');
    const assignmentId = searchParams.get('assignment_id');
    const status = searchParams.get('status');
    const latest = searchParams.get('latest'); // Get only the latest submission

    let query = `
      SELECT 
        tas.*,
        tva.assignment_title,
        tv.title as video_title,
        ts.full_name as teacher_name
      FROM training_assignment_submissions tas
      LEFT JOIN training_video_assignments tva ON tas.assignment_id = tva.id
      LEFT JOIN training_videos tv ON tva.video_id = tv.id
      LEFT JOIN training_teacher_stats ts ON tas.teacher_code = ts.teacher_code
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (teacherCode) {
      query += ` AND tas.teacher_code = $${paramIndex}`;
      values.push(teacherCode);
      paramIndex++;
    }

    if (assignmentId) {
      query += ` AND tas.assignment_id = $${paramIndex}`;
      values.push(assignmentId);
      paramIndex++;
    }

    if (status) {
      query += ` AND tas.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    query += ' ORDER BY tas.created_at DESC';

    // If latest flag is set, limit to 1 result
    if (latest === 'true') {
      query += ' LIMIT 1';
    }

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

// POST: Create new submission (teacher starts assignment)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teacher_code,
      assignment_id,
      attempt_number = 1
    } = body;

    if (!teacher_code || !assignment_id) {
      return NextResponse.json(
        { error: 'teacher_code and assignment_id are required' },
        { status: 400 }
      );
    }

    // Check if there's already an in-progress submission
    const existingQuery = `
      SELECT * FROM training_assignment_submissions 
      WHERE teacher_code = $1 AND assignment_id = $2 AND status = 'in_progress'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const existingResult = await pool.query(existingQuery, [teacher_code, assignment_id]);
    
    if (existingResult.rows.length > 0) {
      // Return existing in-progress submission
      return NextResponse.json({
        success: true,
        data: existingResult.rows[0],
        message: 'Continuing existing submission'
      });
    }

    // Get total points from assignment
    const assignmentQuery = 'SELECT total_points FROM training_video_assignments WHERE id = $1';
    const assignmentResult = await pool.query(assignmentQuery, [assignment_id]);

    if (assignmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const totalPoints = assignmentResult.rows[0].total_points;

    // Calculate next attempt number
    const attemptQuery = `
      SELECT COALESCE(MAX(attempt_number), 0) + 1 as next_attempt
      FROM training_assignment_submissions
      WHERE teacher_code = $1 AND assignment_id = $2
    `;
    const attemptResult = await pool.query(attemptQuery, [teacher_code, assignment_id]);
    const nextAttempt = attemptResult.rows[0].next_attempt;

    const query = `
      INSERT INTO training_assignment_submissions (
        teacher_code,
        assignment_id,
        attempt_number,
        total_points,
        status,
        started_at
      ) VALUES ($1, $2, $3, $4, 'in_progress', NOW())
      RETURNING *
    `;

    const values = [teacher_code, assignment_id, nextAttempt, totalPoints];
    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Submission started successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating submission:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: 'Failed to create submission',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// PUT: Update submission (submit or grade)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Submission id is required' },
        { status: 400 }
      );
    }

    let query = '';
    let values: any[] = [];

    if (action === 'submit') {
      // Teacher submits assignment
      query = `
        UPDATE training_assignment_submissions
        SET 
          status = 'submitted',
          submitted_at = NOW(),
          time_spent_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
        WHERE id = $1
        RETURNING *
      `;
      values = [id];
    } else if (action === 'grade') {
      // System or admin grades assignment
      const { score, is_passed } = updates;
      
      if (score === undefined) {
        return NextResponse.json(
          { error: 'score is required for grading' },
          { status: 400 }
        );
      }

      // Validate and parse score
      const parsedScore = typeof score === 'number' ? score : parseFloat(score);
      if (isNaN(parsedScore)) {
        console.error('[Submission] Invalid score value:', score, 'type:', typeof score);
        return NextResponse.json(
          { error: 'Invalid score value. Must be a valid number.' },
          { status: 400 }
        );
      }

      console.log('[Submission] Grading submission:', { id, score: parsedScore, is_passed });

      query = `
        UPDATE training_assignment_submissions
        SET 
          score = $1,
          percentage = ($1 / total_points * 100),
          is_passed = $2,
          status = 'graded',
          graded_at = NOW()
        WHERE id = $3
        RETURNING *, (SELECT teacher_code FROM training_assignment_submissions WHERE id = $3) as teacher_code,
                     (SELECT video_id FROM training_video_assignments WHERE id = (SELECT assignment_id FROM training_assignment_submissions WHERE id = $3)) as video_id
      `;
      values = [parsedScore, is_passed, id];
      
      // Execute the update
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Submission not found' },
          { status: 404 }
        );
      }

      const submission = result.rows[0];

      // If assignment is passed, mark video as completed
      if (is_passed && submission.teacher_code && submission.video_id) {
        console.log('[Submission] Marking video as completed:', {
          teacher_code: submission.teacher_code,
          video_id: submission.video_id,
          score: score
        });

        // Ensure teacher exists in training_teacher_stats (auto-create if not exists)
        const ensureTeacherQuery = `
          INSERT INTO training_teacher_stats (teacher_code, full_name, work_email, status)
          VALUES ($1, $1, '', 'Active')
          ON CONFLICT (teacher_code) DO NOTHING
        `;
        await pool.query(ensureTeacherQuery, [submission.teacher_code]);

        const updateVideoScoreQuery = `
          INSERT INTO training_teacher_video_scores (
            teacher_code,
            video_id,
            score,
            completion_status,
            completed_at
          ) VALUES ($1, $2, $3, 'completed', NOW())
          ON CONFLICT (teacher_code, video_id)
          DO UPDATE SET
            score = GREATEST(training_teacher_video_scores.score, $3),
            completion_status = 'completed',
            completed_at = CASE 
              WHEN training_teacher_video_scores.completion_status != 'completed' 
              THEN NOW() 
              ELSE training_teacher_video_scores.completed_at 
            END,
            updated_at = NOW()
        `;
        
        await pool.query(updateVideoScoreQuery, [
          submission.teacher_code,
          submission.video_id,
          score
        ]);

        console.log('[Submission] Video completion marked successfully');
      }

      return NextResponse.json({
        success: true,
        data: submission,
        message: 'Submission updated successfully'
      });
    } else {
      // General update
      const allowedFields = ['score', 'status', 'time_spent_seconds'];
      const setClauses: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          setClauses.push(`${key} = $${paramIndex}`);
          updateValues.push(updates[key]);
          paramIndex++;
        }
      });

      if (setClauses.length === 0) {
        return NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        );
      }

      updateValues.push(id);
      query = `
        UPDATE training_assignment_submissions
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      values = updateValues;
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Submission updated successfully'
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json(
      { error: 'Failed to update submission' },
      { status: 500 }
    );
  }
}

// DELETE: Delete submission
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Submission id is required' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM training_assignment_submissions WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return NextResponse.json(
      { error: 'Failed to delete submission' },
      { status: 500 }
    );
  }
}

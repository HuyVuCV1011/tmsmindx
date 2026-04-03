import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const { teacherCode, videoId, timeSpent, isCompleted, totalDuration } = await request.json();

    if (!teacherCode || !videoId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Ensure teacher profile is consistent even when only watching video (no submission yet).
    try {
      const teacherInfoResult = await pool.query(
        `
          SELECT
            COALESCE(NULLIF(full_name, ''), $1) AS full_name,
            COALESCE(NULLIF(user_name, ''), NULL) AS username,
            COALESCE(NULLIF(work_email, ''), '') AS work_email,
            COALESCE(NULLIF(main_centre, ''), NULL) AS center,
            COALESCE(NULLIF(course_line, ''), NULL) AS teaching_block
          FROM teachers
          WHERE code = $1
          LIMIT 1
        `,
        [teacherCode]
      );

      const teacherInfo = teacherInfoResult.rows[0] || null;

      await pool.query(
        `
          INSERT INTO training_teacher_stats
            (teacher_code, full_name, username, work_email, center, teaching_block, status, total_score)
          VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0.00)
          ON CONFLICT (teacher_code)
          DO UPDATE SET
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), training_teacher_stats.full_name),
            username = COALESCE(NULLIF(EXCLUDED.username, ''), training_teacher_stats.username),
            work_email = COALESCE(NULLIF(EXCLUDED.work_email, ''), training_teacher_stats.work_email),
            center = COALESCE(NULLIF(EXCLUDED.center, ''), training_teacher_stats.center),
            teaching_block = COALESCE(NULLIF(EXCLUDED.teaching_block, ''), training_teacher_stats.teaching_block),
            updated_at = NOW()
        `,
        [
          teacherCode,
          teacherInfo?.full_name || teacherCode,
          teacherInfo?.username || null,
          teacherInfo?.work_email || '',
          teacherInfo?.center || null,
          teacherInfo?.teaching_block || null,
        ]
      );
    } catch (syncError) {
      console.error('Failed to sync training_teacher_stats from teachers:', syncError);
    }

    // Step 0: If totalDuration is provided, update the video metadata
    if (totalDuration && typeof totalDuration === 'number' && totalDuration > 0) {
        // Calculate minutes (rounded up, at least 1)
        const durationMinutes = Math.max(1, Math.ceil(totalDuration / 60));
        
        // Update video duration if it's different or NULL
        // We use a separate try-catch to not block progress saving if this fails
        try {
            await pool.query(`
                UPDATE training_videos 
                SET duration_minutes = $1 
                WHERE id = $2 AND (duration_minutes IS NULL OR duration_minutes != $1)
            `, [durationMinutes, videoId]);
        } catch (err) {
            console.error('Failed to update video duration:', err);
        }
    }

    // Determine status
    // If isCompleted is explicitly true, mark as completed.
    // Otherwise, if timeSpent > 0, consider it 'in_progress' unless already completed.
    
    // We need to handle the case where it's already completed. 
    // The ON CONFLICT clause handles updates.
    
    const statusParam = isCompleted ? 'completed' : (timeSpent > 0 ? 'in_progress' : 'not_started');

    const sql = `
      INSERT INTO training_teacher_video_scores
      (teacher_code, video_id, time_spent_seconds, completion_status, completed_at, updated_at, first_viewed_at, view_count)
      VALUES ($1, $2, $3, $4::text, CASE WHEN $4::text = 'completed' THEN NOW() ELSE NULL END, NOW(), NOW(), 1)
      ON CONFLICT (teacher_code, video_id)
      DO UPDATE SET
        time_spent_seconds = GREATEST(training_teacher_video_scores.time_spent_seconds, EXCLUDED.time_spent_seconds),
        view_count = GREATEST(training_teacher_video_scores.view_count, 1),
        completion_status = CASE 
          WHEN training_teacher_video_scores.completion_status = 'completed' THEN 'completed'
          ELSE EXCLUDED.completion_status
        END,
        completed_at = CASE 
          WHEN training_teacher_video_scores.completion_status = 'completed' THEN training_teacher_video_scores.completed_at
          WHEN EXCLUDED.completion_status = 'completed' THEN NOW()
          ELSE training_teacher_video_scores.completed_at
        END,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(sql, [teacherCode, videoId, Math.floor(timeSpent), statusParam]);

    return NextResponse.json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});

export const GET = withApiProtection(async (request: NextRequest) => {
  const teacherCode = request.nextUrl.searchParams.get('teacherCode');
  const videoId = request.nextUrl.searchParams.get('videoId');

  if (!teacherCode || !videoId) {
    return NextResponse.json({ error: 'Missing teacherCode or videoId' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      'SELECT time_spent_seconds, completion_status FROM training_teacher_video_scores WHERE teacher_code = $1 AND video_id = $2',
      [teacherCode, videoId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});

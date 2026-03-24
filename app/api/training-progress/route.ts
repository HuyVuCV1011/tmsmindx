import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const { teacherCode, videoId, timeSpent, isCompleted } = await request.json();

    if (!teacherCode || !videoId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Determine status
    // If isCompleted is explicitly true, mark as completed.
    // Otherwise, if timeSpent > 0, consider it 'in_progress' unless already completed.
    
    // We need to handle the case where it's already completed. 
    // The ON CONFLICT clause handles updates.
    
    const statusParam = isCompleted ? 'completed' : (timeSpent > 0 ? 'in_progress' : 'not_started');

    const sql = `
      INSERT INTO training_teacher_video_scores
      (teacher_code, video_id, time_spent_seconds, completion_status, completed_at, updated_at, first_viewed_at)
      VALUES ($1, $2, $3, $4::text, CASE WHEN $4::text = 'completed' THEN NOW() ELSE NULL END, NOW(), NOW())
      ON CONFLICT (teacher_code, video_id)
      DO UPDATE SET
        time_spent_seconds = GREATEST(training_teacher_video_scores.time_spent_seconds, EXCLUDED.time_spent_seconds),
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

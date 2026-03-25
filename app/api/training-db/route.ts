import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teacherCode = searchParams.get('code');

    console.log('[Training DB API] Fetching data for teacher code:', teacherCode);

    if (!teacherCode) {
      return NextResponse.json({ error: 'Teacher code is required' }, { status: 400 });
    }

    // Fetch teacher stats - auto-create if not exists
    const teacherQuery = `
      INSERT INTO training_teacher_stats 
      (teacher_code, full_name, work_email, status, total_score)
      VALUES ($1, $1, '', 'Active', 0.00)
      ON CONFLICT (teacher_code) DO UPDATE 
      SET updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const teacherResult = await pool.query(teacherQuery, [teacherCode]);
    const teacherStats = teacherResult.rows[0];

    console.log('[Training DB API] Teacher stats loaded:', teacherCode);

    // Fetch all active videos (lessons) ordered by lesson_number
    const videosQuery = `
      SELECT 
        id,
        title,
        video_link,
        thumbnail_url,
        description,
        duration_minutes,
        lesson_number,
        status
      FROM training_videos
      WHERE status = 'active'
      ORDER BY lesson_number ASC
    `;
    const videosResult = await pool.query(videosQuery);

    // Fetch teacher's scores for each video
    const scoresQuery = `
      SELECT 
        video_id,
        score,
        completion_status,
        completed_at,
        time_spent_seconds
      FROM training_teacher_video_scores
      WHERE teacher_code = $1
    `;
    const scoresResult = await pool.query(scoresQuery, [teacherCode]);

    // Create a map of video_id to score
    const scoresMap = new Map();
    scoresResult.rows.forEach(row => {
      scoresMap.set(row.video_id, {
        score: parseFloat(row.score) || 0,
        completion_status: row.completion_status,
        completed_at: row.completed_at,
        time_spent_seconds: row.time_spent_seconds || 0
      });
    });

    // Build lessons array with scores
    const lessons = videosResult.rows.map((video, index) => {
      const scoreData = scoresMap.get(video.id);
      return {
        id: video.id,
        name: video.title,
        score: scoreData ? scoreData.score : 0,
        link: video.video_link,
        thumbnail_url: video.thumbnail_url,
        description: video.description,
        duration_minutes: video.duration_minutes,
        lesson_number: video.lesson_number || (index + 1),
        completion_status: scoreData ? scoreData.completion_status : 'not_started',
        completed_at: scoreData ? scoreData.completed_at : null,
        time_spent_seconds: scoreData ? scoreData.time_spent_seconds : 0
      };
    });

    // Calculate average score from completed lessons
    const completedLessons = lessons.filter(l => l.score > 0);
    const averageScore = completedLessons.length > 0
      ? completedLessons.reduce((sum, l) => sum + l.score, 0) / completedLessons.length
      : 0;

    const trainingData = {
      no: teacherStats.id,
      fullName: teacherStats.full_name,
      code: teacherStats.teacher_code,
      userName: teacherStats.username,
      workEmail: teacherStats.work_email,
      phoneNumber: teacherStats.phone_number,
      status: teacherStats.status,
      centers: teacherStats.center,
      khoiFinal: teacherStats.teaching_block,
      position: teacherStats.position,
      averageScore: parseFloat(averageScore.toFixed(2)),
      totalScore: parseFloat(teacherStats.total_score) || 0,
      lessons: lessons
    };

    console.log('[Training DB API] Successfully fetched data for:', teacherCode);
    console.log('[Training DB API] Total lessons:', lessons.length);
    console.log('[Training DB API] Completed lessons:', completedLessons.length);
    console.log('[Training DB API] Average score:', averageScore.toFixed(2));

    return NextResponse.json(trainingData);
  } catch (error) {
    console.error('[Training DB API] Error:', error);
    console.error('[Training DB API] Error details:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to fetch training data from database'
      },
      { status: 500 }
    );
  }
});

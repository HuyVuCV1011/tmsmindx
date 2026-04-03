import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import ffprobe from 'ffprobe-static';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function getVideoDurationInSeconds(url: string, ffprobePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      url
    ]);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error('Failed to get video duration:', error);
    return 0;
  }
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teacherCode = searchParams.get('code');

    console.log('[Training DB API] Fetching data for teacher code:', teacherCode);

    if (!teacherCode) {
      return NextResponse.json({ error: 'Teacher code is required' }, { status: 400 });
    }

    // Fetch teacher stats - auto-create if not exists, but always enrich from teachers table when possible.
    const teacherInfoQuery = `
      SELECT
        COALESCE(NULLIF(full_name, ''), $1) AS full_name,
        COALESCE(NULLIF(user_name, ''), NULL) AS username,
        COALESCE(NULLIF(work_email, ''), '') AS work_email,
        COALESCE(NULLIF(main_centre, ''), NULL) AS center,
        COALESCE(NULLIF(course_line, ''), NULL) AS teaching_block
      FROM teachers
      WHERE code = $1
      LIMIT 1
    `;
    const teacherInfoResult = await pool.query(teacherInfoQuery, [teacherCode]);
    const teacherInfo = teacherInfoResult.rows[0] || null;

    const teacherQuery = `
      INSERT INTO training_teacher_stats 
      (teacher_code, full_name, username, work_email, center, teaching_block, status, total_score)
      VALUES ($1, $2, $3, $4, $5, $6, 'Active', 0.00)
      ON CONFLICT (teacher_code) DO UPDATE 
      SET
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), training_teacher_stats.full_name),
        username = COALESCE(NULLIF(EXCLUDED.username, ''), training_teacher_stats.username),
        work_email = COALESCE(NULLIF(EXCLUDED.work_email, ''), training_teacher_stats.work_email),
        center = COALESCE(NULLIF(EXCLUDED.center, ''), training_teacher_stats.center),
        teaching_block = COALESCE(NULLIF(EXCLUDED.teaching_block, ''), training_teacher_stats.teaching_block),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const teacherResult = await pool.query(teacherQuery, [
      teacherCode,
      teacherInfo?.full_name || teacherCode,
      teacherInfo?.username || null,
      teacherInfo?.work_email || '',
      teacherInfo?.center || null,
      teacherInfo?.teaching_block || null,
    ]);
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

    // Auto-update duration for videos with placeholder (30 mins) or missing duration
    const durationUpdates = videosResult.rows
      .filter(video => (!video.duration_minutes || video.duration_minutes === 30) && video.video_link)
      .map(async (video) => {
        try {
          // Use ffprobe to get actual duration
          console.log(`[Training DB API] Fetching duration for video ${video.id}...`);
          const durationSec = await getVideoDurationInSeconds(video.video_link, ffprobe.path);
          const minutes = Math.max(1, Math.ceil(durationSec / 60));
          
          if (minutes > 0 && minutes !== 30) {
            await pool.query('UPDATE training_videos SET duration_minutes = $1 WHERE id = $2', [minutes, video.id]);
            video.duration_minutes = minutes; // Update local object for response
            console.log(`[Training DB API] Updated video ${video.id} duration to ${minutes} mins`);
          }
        } catch (err) {
          console.error(`[Training DB API] Failed to update duration for video ${video.id}:`, err);
        }
      });
    
    // Process updates in parallel (await to ensure response has correct data)
    if (durationUpdates.length > 0) {
      await Promise.all(durationUpdates);
    }

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

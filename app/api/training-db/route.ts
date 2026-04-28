import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from '@/lib/datasource-api-auth';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { normalizeStorageUrl } from '@/lib/storage-url';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const teacherCode = searchParams.get('code');

    console.log('[Training DB API] Fetching data for teacher code:', teacherCode);

    if (!teacherCode) {
      return NextResponse.json({ error: 'Teacher code is required' }, { status: 400 });
    }

    const denied = await rejectIfDatasourceLookupForbidden(
      auth.sessionEmail,
      auth.privileged,
      '',
      teacherCode,
    );
    if (denied) return denied;

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
        video_group_id,
        chunk_index,
        chunk_total,
        thumbnail_url,
        description,
        duration_minutes,
        duration_seconds,
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
          // Duration calculate logic has been removed to avoid memory crashes on Vercel
          console.log(`[Training DB API] Keeping default 30 duration for video ${video.id}...`);
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

    // Group split videos into one representative lesson per group.
    const groupedVideoMap = new Map<string, any[]>();
    videosResult.rows.forEach((video) => {
      const groupKey = video.video_group_id ? `group:${video.video_group_id}` : `single:${video.id}`;
      if (!groupedVideoMap.has(groupKey)) groupedVideoMap.set(groupKey, []);
      groupedVideoMap.get(groupKey)!.push(video);
    });

    const groupedVideos = Array.from(groupedVideoMap.values()).map((videosInGroup) => {
      const sorted = [...videosInGroup].sort((a, b) => {
        const left = a.chunk_index ?? 0;
        const right = b.chunk_index ?? 0;
        if (left !== right) return left - right;
        return a.id - b.id;
      });

      const representative = sorted[0];
      const totalDuration = sorted.reduce((sum, item) => sum + (Number(item.duration_minutes) || 0), 0);
      const normalizedTitle = representative.title
        ? representative.title.replace(/\s*[-–—]?\s*(\[?P\d+(\/\d+)?\]?|part-\d+)\s*$/i, '').replace(/\s*\(Phần \d+\)$/i, '').trim()
        : representative.title;

      // Extract segments out to a dedicated array instead of Cloudinary concatenation.
      const segments = sorted.map((vid) => ({
         id: vid.id,
         url: normalizeStorageUrl(vid.video_link),
         // We pass chunk duration for the specialized player later (fallback if duration is faulty)
         duration_minutes: Number(vid.duration_minutes) || 0,
         duration_seconds: vid.duration_seconds != null ? Number(vid.duration_seconds) : null
      }));

      return {
        ...representative,
        title: normalizedTitle || representative.title,
        duration_minutes: totalDuration > 0 ? totalDuration : representative.duration_minutes,
        video_link: representative.video_link, // Representative cover
        segments: segments, // Push array of links to frontend
        source_video_ids: sorted.map((item) => item.id),
      };
    });

    // Build lessons with score merged from all source parts in each group.
    const lessons = groupedVideos.map((video, index) => {
      const sourceIds: number[] = Array.isArray(video.source_video_ids) ? video.source_video_ids : [video.id];
      const scoreCandidates = sourceIds
        .map((id) => scoresMap.get(id))
        .filter(Boolean);

      const scoreData = scoreCandidates.length > 0
        ? scoreCandidates.reduce((best: any, current: any) => {
            const statusPriority = (status: string | null | undefined) => {
              if (status === 'completed') return 2;
              if (status === 'in_progress') return 1;
              return 0;
            };

            const bestPriority = statusPriority(best?.completion_status);
            const currentPriority = statusPriority(current?.completion_status);
            if (currentPriority > bestPriority) return current;
            if (currentPriority < bestPriority) return best;

            const bestTime = Number(best?.time_spent_seconds || 0);
            const currentTime = Number(current?.time_spent_seconds || 0);
            if (currentTime > bestTime) return current;

            return best;
          }, scoreCandidates[0])
        : null;

      return {
        id: video.id,
        name: video.title || `Video ${video.id}`,
        score: scoreData ? scoreData.score : 0,
        link: normalizeStorageUrl(video.video_link),
        segments: video.segments, // Included chunks 
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

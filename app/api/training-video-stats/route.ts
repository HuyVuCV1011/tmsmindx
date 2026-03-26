import { NextRequest, NextResponse } from 'next/server';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    // Per-video aggregate stats
    const videoStatsResult = await pool.query(`
      SELECT
        tv.id as video_id,
        tv.title,
        tv.status,
        tv.created_at,
        COUNT(DISTINCT tts.teacher_code) as total_assigned,
        COUNT(DISTINCT tvs.teacher_code) as total_viewed,
        COUNT(DISTINCT tvs.teacher_code) FILTER (WHERE tvs.completion_status = 'completed') as total_completed,
        ROUND(
          COUNT(DISTINCT tvs.teacher_code) * 100.0 / NULLIF(COUNT(DISTINCT tts.teacher_code), 0),
          1
        ) as watch_rate_pct,
        -- Q&A stats: dùng score > 0 làm proxy (giáo viên đã trả lời câu hỏi)
        COUNT(DISTINCT tvs.teacher_code) FILTER (
          WHERE tvs.score IS NOT NULL AND tvs.score > 0
        ) as qa_answered_count,
        ROUND(
          COUNT(DISTINCT tvs.teacher_code) FILTER (
            WHERE tvs.score IS NOT NULL AND tvs.score > 0
          ) * 100.0 / NULLIF(COUNT(DISTINCT tts.teacher_code), 0),
          1
        ) as qa_rate_pct
      FROM training_videos tv
      LEFT JOIN training_teacher_stats tts ON tv.status = 'active'
      LEFT JOIN training_teacher_video_scores tvs ON tv.id = tvs.video_id AND tts.teacher_code = tvs.teacher_code
      WHERE tv.status = 'active'
      GROUP BY tv.id, tv.title, tv.status, tv.created_at
      ORDER BY tv.created_at ASC
    `);


    // Per-teacher, per-video matrix
    const teacherMatrixResult = await pool.query(`
      SELECT
        tts.teacher_code,
        tts.full_name,
        tts.center,
        tts.teaching_block,
        tv.id as video_id,
        tv.title as video_title,
        tvs.completion_status,
        tvs.time_spent_seconds,
        tvs.score
      FROM training_teacher_stats tts
      CROSS JOIN training_videos tv
      LEFT JOIN training_teacher_video_scores tvs 
        ON tv.id = tvs.video_id AND tts.teacher_code = tvs.teacher_code
      WHERE tv.status = 'active'
      ORDER BY tts.full_name ASC, tv.created_at ASC
    `);

    // group matrix by teacher
    const teacherMap = new Map<string, {
      teacher_code: string;
      full_name: string;
      center: string;
      teaching_block: string;
      videos: Record<string, { completion_status: string | null; time_spent_seconds: number; score: number | null }>;
    }>();

    for (const row of teacherMatrixResult.rows) {
      if (!teacherMap.has(row.teacher_code)) {
        teacherMap.set(row.teacher_code, {
          teacher_code: row.teacher_code,
          full_name: row.full_name,
          center: row.center,
          teaching_block: row.teaching_block,
          videos: {},
        });
      }
      const entry = teacherMap.get(row.teacher_code)!;
      entry.videos[row.video_id] = {
        completion_status: row.completion_status || null,
        time_spent_seconds: row.time_spent_seconds ? parseInt(row.time_spent_seconds) : 0,
        score: row.score != null ? parseFloat(row.score) : null,
      };
    }

    return NextResponse.json({
      success: true,
      video_stats: videoStatsResult.rows.map(row => ({
        video_id: row.video_id,
        title: row.title,
        status: row.status,
        total_assigned: parseInt(row.total_assigned) || 0,
        total_viewed: parseInt(row.total_viewed) || 0,
        total_completed: parseInt(row.total_completed) || 0,
        watch_rate_pct: parseFloat(row.watch_rate_pct) || 0,
        qa_answered_count: parseInt(row.qa_answered_count) || 0,
        qa_rate_pct: parseFloat(row.qa_rate_pct) || 0,
      })),
      teacher_matrix: Array.from(teacherMap.values()),
    });
  } catch (error) {
    console.error('[Video Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

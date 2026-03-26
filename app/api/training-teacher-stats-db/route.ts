import { NextRequest, NextResponse } from 'next/server';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Multi-center: comma-separated list e.g. "CS1,CS2"
    const centersParam = searchParams.get('centers');
    const teacherCode = searchParams.get('teacher_code');
    const block = searchParams.get('block');

    console.log('[Teacher Stats API] Fetching teacher statistics with filters:', { centersParam, teacherCode, block });

    const params: any[] = [];
    const conditions: string[] = [];
    let paramIdx = 1;

    if (centersParam) {
      const centerList = centersParam.split(',').map(c => c.trim()).filter(Boolean);
      if (centerList.length > 0) {
        conditions.push(`t.main_centre = ANY($${paramIdx}::text[])`);
        params.push(centerList);
        paramIdx++;
      }
    }

    if (teacherCode) {
      conditions.push(`ts.teacher_code ILIKE $${paramIdx}`);
      params.push(`%${teacherCode}%`);
      paramIdx++;
    }

    if (block) {
      conditions.push(`t.course_line = $${paramIdx}`);
      params.push(block);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        ts.teacher_code,
        COALESCE(t.full_name, ts.full_name) as full_name,
        COALESCE(t.user_name, ts.username) as username,
        COALESCE(t.work_email, ts.work_email) as work_email,
        COALESCE(t.main_centre, ts.center) as center,
        COALESCE(t.course_line, ts.teaching_block) as teaching_block,
        COALESCE(t.status, ts.status) as teacher_status,
        ts.total_score,
        COUNT(DISTINCT tvs.video_id) FILTER (WHERE tvs.completion_status = 'completed') as videos_completed,
        COUNT(DISTINCT CASE WHEN tv.status = 'active' THEN tv.id END) as total_videos_assigned,
        AVG(tvs.score) FILTER (WHERE tvs.score > 0) as avg_video_score,
        COUNT(DISTINCT tas.id) as total_assignments_taken,
        COUNT(DISTINCT tas.id) FILTER (WHERE tas.is_passed = true) as assignments_passed,
        AVG(tas.score) FILTER (WHERE tas.status = 'graded') as avg_assignment_score,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'video_id', tvs.video_id,
              'score', tvs.score,
              'completion_status', tvs.completion_status,
              'time_spent_seconds', tvs.time_spent_seconds
            )
          ) FILTER (WHERE tvs.video_id IS NOT NULL),
          '[]'
        ) as video_scores
      FROM training_teacher_stats ts
      LEFT JOIN teachers t ON ts.teacher_code = t.code
      LEFT JOIN training_teacher_video_scores tvs ON ts.teacher_code = tvs.teacher_code
      LEFT JOIN training_videos tv ON tvs.video_id = tv.id AND tv.status = 'active'
      LEFT JOIN training_assignment_submissions tas ON ts.teacher_code = tas.teacher_code
      ${whereClause}
      GROUP BY 
        ts.teacher_code, 
        t.full_name, ts.full_name, 
        t.user_name, ts.username, 
        t.work_email, ts.work_email, 
        t.main_centre, ts.center, 
        t.course_line, ts.teaching_block, 
        t.status, ts.status, 
        ts.total_score
      ORDER BY ts.total_score DESC, COALESCE(t.full_name, ts.full_name) ASC
    `;

    const result = await pool.query(query, params);

    // Fetch all active videos for column metadata
    const videosResult = await pool.query(
      `SELECT id, title, created_at FROM training_videos WHERE status = 'active' ORDER BY created_at ASC`
    );

    const stats = result.rows.map(row => ({
      teacher_code: row.teacher_code,
      full_name: row.full_name,
      username: row.username,
      work_email: row.work_email,
      center: row.center,
      teaching_block: row.teaching_block,
      teacher_status: row.teacher_status,
      total_score: parseFloat(row.total_score) || 0,
      total_videos_assigned: parseInt(row.total_videos_assigned) || 0,
      videos_completed: parseInt(row.videos_completed) || 0,
      avg_video_score: row.avg_video_score ? parseFloat(row.avg_video_score).toFixed(2) : null,
      total_assignments_taken: parseInt(row.total_assignments_taken) || 0,
      assignments_passed: parseInt(row.assignments_passed) || 0,
      avg_assignment_score: row.avg_assignment_score ? parseFloat(row.avg_assignment_score).toFixed(2) : null,
      video_scores: Array.isArray(row.video_scores) ? row.video_scores : [],
    }));

    console.log('[Teacher Stats API] Successfully fetched', stats.length, 'teacher stats');

    return NextResponse.json({
      success: true,
      data: stats,
      count: stats.length,
      active_videos: videosResult.rows,
    });
  } catch (error) {
    console.error('[Teacher Stats API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

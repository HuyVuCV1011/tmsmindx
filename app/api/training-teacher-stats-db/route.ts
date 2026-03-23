import { NextRequest, NextResponse } from 'next/server';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const center = searchParams.get('center');

    console.log('[Teacher Stats API] Fetching teacher statistics');

    // Build query with optional center filter
    let query = `
      SELECT 
        ts.teacher_code,
        ts.full_name,
        ts.username,
        ts.work_email,
        ts.center,
        ts.status as teacher_status,
        ts.total_score,
        COUNT(DISTINCT tvs.video_id) FILTER (WHERE tvs.score > 0) as videos_completed,
        COUNT(DISTINCT CASE WHEN tv.status = 'active' THEN tv.id END) as total_videos_assigned,
        AVG(tvs.score) FILTER (WHERE tvs.score > 0) as avg_video_score,
        COUNT(DISTINCT tas.id) as total_assignments_taken,
        COUNT(DISTINCT tas.id) FILTER (WHERE tas.is_passed = true) as assignments_passed,
        AVG(tas.score) FILTER (WHERE tas.status = 'graded') as avg_assignment_score
      FROM training_teacher_stats ts
      LEFT JOIN training_teacher_video_scores tvs ON ts.teacher_code = tvs.teacher_code
      LEFT JOIN training_videos tv ON tvs.video_id = tv.id
      LEFT JOIN training_assignment_submissions tas ON ts.teacher_code = tas.teacher_code
    `;

    const params: any[] = [];
    if (center) {
      query += ' WHERE ts.center = $1';
      params.push(center);
    }

    query += `
      GROUP BY ts.teacher_code, ts.full_name, ts.username, ts.work_email, ts.center, ts.status, ts.total_score
      ORDER BY ts.total_score DESC, ts.full_name ASC
    `;

    const result = await pool.query(query, params);

    const stats = result.rows.map(row => ({
      teacher_code: row.teacher_code,
      full_name: row.full_name,
      username: row.username,
      work_email: row.work_email,
      center: row.center,
      teacher_status: row.teacher_status,
      total_score: parseFloat(row.total_score) || 0,
      total_videos_assigned: parseInt(row.total_videos_assigned) || 0,
      videos_completed: parseInt(row.videos_completed) || 0,
      avg_video_score: row.avg_video_score ? parseFloat(row.avg_video_score).toFixed(2) : null,
      total_assignments_taken: parseInt(row.total_assignments_taken) || 0,
      assignments_passed: parseInt(row.assignments_passed) || 0,
      avg_assignment_score: row.avg_assignment_score ? parseFloat(row.avg_assignment_score).toFixed(2) : null
    }));

    console.log('[Teacher Stats API] Successfully fetched', stats.length, 'teacher stats');

    return NextResponse.json({
      success: true,
      data: stats,
      count: stats.length
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

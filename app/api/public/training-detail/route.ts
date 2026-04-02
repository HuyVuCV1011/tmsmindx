import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Public route - no auth required
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ success: false, error: 'Thiếu mã giáo viên' }, { status: 400 });
    }

    // Get teacher info
    const teacherResult = await pool.query(
      `SELECT teacher_code, full_name, center, teaching_block, total_score, status
       FROM training_teacher_stats
       WHERE teacher_code = $1`,
      [code]
    );

    if (teacherResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy giáo viên' }, { status: 404 });
    }

    const teacher = teacherResult.rows[0];

    // Get per-video scores
    // Debug: Log query execution
    console.log(`[Public Training Detail API] Fetching scores for ${code}`);
    
    const scoresResult = await pool.query(
      `SELECT 
         tvs.video_id,
         tv.title as video_title,
         tv.video_link as video_link,
         tv.description as video_description,
         tv.status as video_status,
         tvs.score,
         tvs.completion_status,
         tvs.time_spent_seconds,
         tvs.first_viewed_at,
         tvs.completed_at,
         (
           SELECT tas.id 
           FROM training_assignment_submissions tas
           JOIN training_video_assignments tva ON tas.assignment_id = tva.id
           WHERE tva.video_id = tvs.video_id 
             AND tas.teacher_code = tvs.teacher_code
           ORDER BY tas.score DESC, tas.created_at DESC
           LIMIT 1
         ) as submission_id
       FROM training_teacher_video_scores tvs
       JOIN training_videos tv ON tvs.video_id = tv.id
       WHERE tvs.teacher_code = $1
       ORDER BY tv.created_at ASC`,
      [code]
    );

    return NextResponse.json({
      success: true,
      teacher: {
        teacher_code: teacher.teacher_code,
        full_name: teacher.full_name,
        center: teacher.center,
        teaching_block: teacher.teaching_block,
        total_score: parseFloat(teacher.total_score) || 0,
        status: teacher.status,
      },
      video_scores: scoresResult.rows.map(row => ({
        video_id: row.video_id,
        video_title: row.video_title,
        video_link: row.video_link,
        video_description: row.video_description,
        score: row.score != null ? parseFloat(row.score) : null,
        completion_status: row.completion_status,
        time_spent_seconds: row.time_spent_seconds ? parseInt(row.time_spent_seconds) : 0,
        viewed_at: row.first_viewed_at,
        completed_at: row.completed_at,
        submission_id: row.submission_id,
        answers: [], // Data answers not available in this view
      })),
    });
  } catch (error) {
    console.error('[Public Training Detail API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

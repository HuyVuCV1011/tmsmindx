import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { deleteObject, parsePublicUrl } from '@/lib/supabase-s3';

/** Xóa ảnh S3 an toàn, không throw */
async function deleteImageSilently(url: string | null) {
  if (!url) return;
  const parsed = parsePublicUrl(url);
  if (!parsed) return;
  try {
    await deleteObject(parsed.bucket, parsed.key);
  } catch (err) {
    console.error(`[S3 Cleanup] Failed to delete ${url}:`, err);
  }
}

// GET: Lấy danh sách assignments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const video_id = searchParams.get('video_id');
    const teacher_code = searchParams.get('teacher_code');
    // status column đã bị xóa (migration V42) — không dùng nữa

    let query = `
      SELECT a.*, v.title as video_title, v.lesson_number
      FROM training_video_assignments a
      LEFT JOIN training_videos v ON a.video_id = v.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (id) {
      params.push(id);
      conditions.push(`a.id = $${params.length}`);
    }
    if (video_id) {
      params.push(video_id);
      conditions.push(`a.video_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY v.lesson_number ASC NULLS LAST, a.created_at DESC';

    const result = await pool.query(query, params);

    // Lấy số lượng câu hỏi cho mỗi assignment
    if (result.rows.length > 0) {
      const assignmentIds = result.rows.map(row => row.id);

      const questionsResult = await pool.query(
        `SELECT assignment_id, COUNT(*) as question_count
         FROM training_assignment_questions
         WHERE assignment_id = ANY($1)
         GROUP BY assignment_id`,
        [assignmentIds]
      );

      const questionCounts = questionsResult.rows.reduce((acc, row) => {
        acc[row.assignment_id] = parseInt(row.question_count);
        return acc;
      }, {} as Record<number, number>);

      // Fetch teacher submissions nếu có teacher_code
      const submissionsMap: Record<number, any> = {};
      if (teacher_code) {
        const submissionsResult = await pool.query(
          `SELECT DISTINCT ON (assignment_id) *
           FROM training_assignment_submissions
           WHERE teacher_code = $1 AND assignment_id = ANY($2)
           ORDER BY assignment_id, submitted_at DESC`,
          [teacher_code, assignmentIds]
        );
        submissionsResult.rows.forEach(sub => {
          submissionsMap[sub.assignment_id] = sub;
        });
      }

      result.rows.forEach(row => {
        row.question_count = questionCounts[row.id] || 0;
        if (teacher_code) {
          row.recent_submission = submissionsMap[row.id] || null;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Tạo assignment mới
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      video_id,
      assignment_title,
      assignment_type = 'quiz',
      description,
    } = body;

    if (!assignment_title) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: assignment_title' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO training_video_assignments
       (video_id, assignment_title, assignment_type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [video_id ? parseInt(video_id, 10) : null, assignment_title, assignment_type, description || null]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật assignment
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    let { id, ...updateData } = body;

    if (!id) {
      const { searchParams } = new URL(request.url);
      id = searchParams.get('id');
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Loại bỏ các field đã bị xóa khỏi DB
    const REMOVED_FIELDS = ['status', 'total_points', 'passing_score', 'time_limit_minutes', 'max_attempts', 'is_required', 'due_date'];
    REMOVED_FIELDS.forEach(f => delete updateData[f]);

    const fields = Object.keys(updateData).filter(key => updateData[key] !== undefined);
    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Build SET clause với đúng $N placeholder
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updateData[field])];

    const result = await pool.query(
      `UPDATE training_video_assignments SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Xóa assignment
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Kiểm tra video status trước khi xóa
    const checkResult = await pool.query(
      `SELECT a.id, v.status AS video_status
       FROM training_video_assignments a
       LEFT JOIN training_videos v ON v.id = a.video_id
       WHERE a.id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (checkResult.rows[0].video_status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa assignment khi video đang Active' },
        { status: 403 }
      );
    }

    // Lấy ảnh của tất cả câu hỏi TRƯỚC khi xóa (CASCADE sẽ xóa questions cùng lúc với assignment)
    const questions = await pool.query(
      'SELECT image_url FROM training_assignment_questions WHERE assignment_id = $1 AND image_url IS NOT NULL',
      [id]
    );

    const result = await pool.query(
      'DELETE FROM training_video_assignments WHERE id = $1 RETURNING *',
      [id]
    );

    // Xóa ảnh S3 sau khi DB delete thành công
    questions.rows.forEach(q => deleteImageSilently(q.image_url));

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

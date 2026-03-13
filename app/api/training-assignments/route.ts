import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: Lấy danh sách assignments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const video_id = searchParams.get('video_id');
    const status = searchParams.get('status');

    let query = `
      SELECT a.*, v.title as video_title, v.lesson_number
      FROM training_video_assignments a
      LEFT JOIN training_videos v ON a.video_id = v.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (id) {
      conditions.push(`a.id = $${params.length + 1}`);
      params.push(id);
    }
    if (video_id) {
      conditions.push(`a.video_id = $${params.length + 1}`);
      params.push(video_id);
    }
    if (status) {
      conditions.push(`a.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY v.lesson_number ASC, a.created_at DESC';

    const result = await pool.query(query, params);

    // Lấy số lượng câu hỏi cho mỗi assignment
    if (result.rows.length > 0) {
      const assignmentIds = result.rows.map(row => row.id);
      const questionsQuery = `
        SELECT assignment_id, COUNT(*) as question_count
        FROM training_assignment_questions
        WHERE assignment_id = ANY($1)
        GROUP BY assignment_id
      `;
      const questionsResult = await pool.query(questionsQuery, [assignmentIds]);
      
      const questionCounts = questionsResult.rows.reduce((acc, row) => {
        acc[row.assignment_id] = parseInt(row.question_count);
        return acc;
      }, {} as Record<number, number>);

      result.rows.forEach(row => {
        row.question_count = questionCounts[row.id] || 0;
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
      total_points = 10.00,
      passing_score = 7.00,
      time_limit_minutes,
      max_attempts = 1,
      is_required = true,
      due_date,
      status = 'draft'
    } = body;

    // Validate
    if (!video_id || !assignment_title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: video_id, assignment_title' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO training_video_assignments 
      (video_id, assignment_title, assignment_type, description, total_points, 
       passing_score, time_limit_minutes, max_attempts, is_required, due_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      video_id, assignment_title, assignment_type, description, total_points,
      passing_score, time_limit_minutes, max_attempts, is_required, due_date, status
    ];

    const result = await pool.query(query, values);

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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    const fields = Object.keys(updateData).filter(key => updateData[key] !== undefined);
    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE training_video_assignments 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const values = [id, ...fields.map(field => updateData[field])];
    const result = await pool.query(query, values);

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

    const assignmentStatusQuery = `
      SELECT a.id, v.status AS video_status
      FROM training_video_assignments a
      JOIN training_videos v ON v.id = a.video_id
      WHERE a.id = $1
    `;
    const assignmentStatusResult = await pool.query(assignmentStatusQuery, [id]);

    if (assignmentStatusResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (assignmentStatusResult.rows[0].video_status === 'active') {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa assignment khi video đang Active' },
        { status: 403 }
      );
    }

    const query = 'DELETE FROM training_video_assignments WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

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

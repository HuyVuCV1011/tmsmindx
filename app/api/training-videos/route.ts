import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: Lấy danh sách videos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    let query = `
      SELECT
        tv.*,
        COALESCE(SUM(tvs.view_count), 0)::INTEGER AS actual_view_count,
        COUNT(DISTINCT tvs.teacher_code) FILTER (WHERE COALESCE(tvs.view_count, 0) > 0)::INTEGER AS actual_viewers
      FROM training_videos tv
      LEFT JOIN training_teacher_video_scores tvs ON tv.id = tvs.video_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (id) {
      conditions.push(`tv.id = $${params.length + 1}`);
      params.push(id);
    }

    if (status) {
      conditions.push(`tv.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' GROUP BY tv.id';

    query += ' ORDER BY tv.lesson_number ASC, tv.created_at DESC';

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error: any) {
    console.error('Error fetching training videos:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Tạo video mới
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      video_link,
      start_date,
      duration_minutes,
      description,
      thumbnail_url,
      lesson_number,
      status = 'draft'
    } = body;

    // Validate required fields
    if (!title || !video_link || !start_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, video_link, start_date' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO training_videos 
      (title, video_link, start_date, duration_minutes, description, thumbnail_url, lesson_number, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      title,
      video_link,
      start_date,
      duration_minutes,
      description,
      thumbnail_url,
      lesson_number,
      status
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Video created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating training video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật video
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Build dynamic update query
    const fields = Object.keys(updateData).filter(key => updateData[key] !== undefined);
    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE training_videos 
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const values = [id, ...fields.map(field => updateData[field])];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Video updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating training video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Xóa video
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Video ID is required' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM training_videos WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error deleting training video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

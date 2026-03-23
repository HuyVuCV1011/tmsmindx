import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: Fetch assignment questions by assignment_id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignment_id');

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'assignment_id is required' },
        { status: 400 }
      );
    }

    const query = `
      SELECT 
        taq.*,
        tva.assignment_title,
        tv.title as video_title
      FROM training_assignment_questions taq
      LEFT JOIN training_video_assignments tva ON taq.assignment_id = tva.id
      LEFT JOIN training_videos tv ON tva.video_id = tv.id
      WHERE taq.assignment_id = $1
      ORDER BY taq.order_number ASC
    `;

    const result = await pool.query(query, [assignmentId]);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching assignment questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment questions' },
      { status: 500 }
    );
  }
}

// POST: Create new assignment question
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assignment_id,
      question_text,
      question_type = 'multiple_choice',
      correct_answer,
      options,
      image_url,
      explanation,
      points = 1.0,
      order_number,
      difficulty = 'medium'
    } = body;

    // Validation
    if (!assignment_id || !question_text) {
      return NextResponse.json(
        { error: 'assignment_id and question_text are required' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO training_assignment_questions (
        assignment_id,
        question_text,
        question_type,
        correct_answer,
        options,
        image_url,
        explanation,
        points,
        order_number,
        difficulty
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      assignment_id,
      question_text,
      question_type,
      correct_answer,
      options ? JSON.stringify(options) : null,
      image_url,
      explanation,
      points,
      order_number,
      difficulty
    ];

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment question created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating assignment question:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment question' },
      { status: 500 }
    );
  }
}

// PUT: Update assignment question
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Question id is required' },
        { status: 400 }
      );
    }

    // Build dynamic update query
    const allowedFields = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'image_url',
      'explanation',
      'points',
      'order_number',
      'difficulty'
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        // Handle JSON fields
        if (key === 'options' && updates[key]) {
          values.push(JSON.stringify(updates[key]));
        } else {
          values.push(updates[key]);
        }
        paramIndex++;
      }
    });

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    const query = `
      UPDATE training_assignment_questions
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assignment question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment question updated successfully'
    });
  } catch (error) {
    console.error('Error updating assignment question:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment question' },
      { status: 500 }
    );
  }
}

// DELETE: Delete assignment question
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Question id is required' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM training_assignment_questions WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assignment question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment question deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment question:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment question' },
      { status: 500 }
    );
  }
}

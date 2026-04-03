import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';

const stripUnstableImageSources = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.replace(
    /<img[^>]+src=["'](?:blob:[^"']*|data:image[^"']*)["'][^>]*>/gi,
    ''
  );
};

// GET: Fetch set questions by set_id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('set_id');

    if (!setId) {
      return NextResponse.json(
        { error: 'set_id is required' },
        { status: 400 }
      );
    }

    const query = `
      SELECT
        esq.id,
        esq.set_id as assignment_id,
        esq.question_text,
        esq.question_type,
        COALESCE(esq.correct_answer, '') as correct_answer,
        esq.options,
        NULL::text as image_url,
        COALESCE(esq.explanation, '') as explanation,
        esq.points,
        esq.order_number,
        'medium'::text as difficulty,
        es.set_code,
        es.set_name,
        esc.subject_name
      FROM exam_set_questions esq
      JOIN exam_sets es ON esq.set_id = es.id
      JOIN exam_subject_catalog esc ON es.subject_id = esc.id
      WHERE esq.set_id = $1
      ORDER BY esq.order_number ASC
    `;

    const result = await pool.query(query, [setId]);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching exam set questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exam set questions' },
      { status: 500 }
    );
  }
}

// POST: Create new set question
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      set_id,
      question_text,
      question_type = 'multiple_choice',
      correct_answer,
      options,
      explanation,
      points = 1,
      order_number,
    } = body;

    if (!set_id || !question_text) {
      return NextResponse.json(
        { error: 'set_id and question_text are required' },
        { status: 400 }
      );
    }

    const normalizedQuestionType: QuestionType = question_type;
    const sanitizedQuestionText = String(stripUnstableImageSources(question_text) || '');
    const sanitizedCorrectAnswer =
      correct_answer == null ? null : String(stripUnstableImageSources(correct_answer) || '');
    const sanitizedExplanation =
      explanation == null ? null : String(stripUnstableImageSources(explanation) || '');
    const sanitizedOptions = Array.isArray(options)
      ? options.map((item) => String(stripUnstableImageSources(item) || '')).filter(Boolean)
      : [];
    const optionsValue = sanitizedOptions.length > 0 ? JSON.stringify(sanitizedOptions) : null;

    const query = `
      INSERT INTO exam_set_questions (
        set_id,
        question_text,
        question_type,
        correct_answer,
        options,
        explanation,
        points,
        order_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      set_id,
      sanitizedQuestionText,
      normalizedQuestionType,
      sanitizedCorrectAnswer,
      optionsValue,
      sanitizedExplanation,
      Number(points || 1),
      Number(order_number || 1),
    ];

    const result = await pool.query(query, values);

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
        message: 'Exam set question created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating exam set question:', error);
    return NextResponse.json(
      { error: 'Failed to create exam set question' },
      { status: 500 }
    );
  }
}

// PUT: Update set question
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

    const allowedFields = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'explanation',
      'points',
      'order_number',
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        if (key === 'options') {
          const optionValue = Array.isArray(updates[key]) && updates[key].length > 0
            ? JSON.stringify(
                updates[key]
                  .map((item: unknown) => String(stripUnstableImageSources(item) || ''))
                  .filter(Boolean)
              )
            : null;
          values.push(optionValue);
        } else if (['question_text', 'correct_answer', 'explanation'].includes(key)) {
          values.push(stripUnstableImageSources(updates[key]));
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
      UPDATE exam_set_questions
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Exam set question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Exam set question updated successfully',
    });
  } catch (error) {
    console.error('Error updating exam set question:', error);
    return NextResponse.json(
      { error: 'Failed to update exam set question' },
      { status: 500 }
    );
  }
}

// DELETE: Delete set question
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

    const query = 'DELETE FROM exam_set_questions WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Exam set question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Exam set question deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting exam set question:', error);
    return NextResponse.json(
      { error: 'Failed to delete exam set question' },
      { status: 500 }
    );
  }
}

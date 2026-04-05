import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
type QuestionDifficulty = 'easy' | 'medium' | 'hard';

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
        q.id,
        sq.set_id as assignment_id,
        q.question_text,
        q.question_type,
        COALESCE(q.correct_answer, '') as correct_answer,
        CASE
          WHEN q.option_a IS NULL AND q.option_b IS NULL AND q.option_c IS NULL AND q.option_d IS NULL THEN NULL
          ELSE jsonb_build_array(q.option_a, q.option_b, q.option_c, q.option_d)
        END AS options,
        NULL::text as image_url,
        COALESCE(q.explanation, '') as explanation,
        COALESCE(sq.points_override, q.points) as points,
        sq.display_order as order_number,
        COALESCE(q.difficulty, 'medium') as difficulty,
        es.set_code,
        es.set_name,
        esc.subject_name
      FROM chuyen_sau_bode_cauhoi sq
      JOIN chuyen_sau_cauhoi q ON q.id = sq.question_id
      JOIN chuyen_sau_bode es ON sq.set_id = es.id
      JOIN chuyen_sau_monhoc esc ON es.subject_id = esc.id
      WHERE sq.set_id = $1
      ORDER BY sq.display_order ASC
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
  const client = await pool.connect();
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
      difficulty = 'medium',
      tags,
    } = body;

    if (!set_id) {
      return NextResponse.json(
        { error: 'set_id is required' },
        { status: 400 }
      );
    }

    const normalizedQuestionType: QuestionType = question_type;
    const normalizedDifficulty: QuestionDifficulty = ['easy', 'medium', 'hard'].includes(difficulty)
      ? difficulty
      : 'medium';
    const canonicalQuestionType = normalizedQuestionType === 'essay' ? 'short_answer' : normalizedQuestionType;
    const sanitizedQuestionText = String(stripUnstableImageSources(question_text) || '');
    const normalizedQuestionText = sanitizedQuestionText.trim() || '[Tam] Chua dan noi dung tu doc';
    const sanitizedCorrectAnswer =
      correct_answer == null ? null : String(stripUnstableImageSources(correct_answer) || '');
    const normalizedCorrectAnswer = sanitizedCorrectAnswer ?? '';
    const sanitizedExplanation =
      explanation == null ? null : String(stripUnstableImageSources(explanation) || '');
    const sanitizedOptions = Array.isArray(options)
      ? options.map((item) => String(stripUnstableImageSources(item) || '')).filter(Boolean)
      : [];
    const optionA = sanitizedOptions[0] || null;
    const optionB = sanitizedOptions[1] || null;
    const optionC = sanitizedOptions[2] || null;
    const optionD = sanitizedOptions[3] || null;
    const normalizedTags = Array.isArray(tags)
      ? tags.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : [];

    await client.query('BEGIN');

    const questionInsert = `
      INSERT INTO chuyen_sau_cauhoi (
        question_text,
        question_type,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        points,
        difficulty,
        tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const questionValues = [
      normalizedQuestionText,
      canonicalQuestionType,
      optionA,
      optionB,
      optionC,
      optionD,
      normalizedCorrectAnswer,
      sanitizedExplanation,
      Number(points || 1),
      normalizedDifficulty,
      normalizedTags,
    ];

    const questionResult = await client.query(questionInsert, questionValues);
    const questionId = questionResult.rows[0].id;

    const mappingInsert = `
      INSERT INTO chuyen_sau_bode_cauhoi (
        set_id,
        question_id,
        display_order
      ) VALUES ($1, $2, $3)
      RETURNING *
    `;

    const mappingValues = [
      set_id,
      questionId,
      Number(order_number || 1),
    ];

    await client.query(mappingInsert, mappingValues);
    await client.query('COMMIT');

    const result = await pool.query(
      `
      SELECT
        q.id,
        sq.set_id as assignment_id,
        q.question_text,
        q.question_type,
        q.correct_answer,
        CASE
          WHEN q.option_a IS NULL AND q.option_b IS NULL AND q.option_c IS NULL AND q.option_d IS NULL THEN NULL
          ELSE jsonb_build_array(q.option_a, q.option_b, q.option_c, q.option_d)
        END AS options,
        q.explanation,
        COALESCE(sq.points_override, q.points) AS points,
        sq.display_order AS order_number,
        q.difficulty,
        q.tags
      FROM chuyen_sau_cauhoi q
      JOIN chuyen_sau_bode_cauhoi sq ON sq.question_id = q.id
      WHERE q.id = $1
      `,
      [questionId]
    );

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
        message: 'Exam set question created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating exam set question:', error);
    return NextResponse.json(
      { error: 'Failed to create exam set question' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PUT: Update set question
export async function PUT(request: NextRequest) {
  let client: Awaited<ReturnType<typeof pool.connect>> | null = null;
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
      'difficulty',
      'tags',
    ];

    const questionClauses: string[] = [];
    const questionValues: any[] = [];
    const mappingClauses: string[] = [];
    const mappingValues: any[] = [];
    let questionIndex = 1;
    let mappingIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        if (key === 'order_number') {
          mappingClauses.push(`display_order = $${mappingIndex}`);
          mappingValues.push(Number(updates[key] || 1));
          mappingIndex++;
          return;
        }

        if (key === 'points') {
          mappingClauses.push(`points_override = $${mappingIndex}`);
          mappingValues.push(Number(updates[key] || 1));
          mappingIndex++;
          return;
        }

        if (key === 'options') {
          const sanitized = Array.isArray(updates[key])
            ? updates[key].map((item: unknown) => String(stripUnstableImageSources(item) || '')).filter(Boolean)
            : [];
          const fields: Array<'option_a' | 'option_b' | 'option_c' | 'option_d'> = ['option_a', 'option_b', 'option_c', 'option_d'];
          fields.forEach((field, idx) => {
            questionClauses.push(`${field} = $${questionIndex}`);
            questionValues.push(sanitized[idx] || null);
            questionIndex++;
          });
        } else if (['question_text', 'correct_answer', 'explanation'].includes(key)) {
          questionClauses.push(`${key} = $${questionIndex}`);
          questionValues.push(stripUnstableImageSources(updates[key]));
          questionIndex++;
        } else if (key === 'question_type') {
          questionClauses.push(`question_type = $${questionIndex}`);
          questionValues.push(updates[key] === 'essay' ? 'short_answer' : updates[key]);
          questionIndex++;
        } else {
          questionClauses.push(`${key} = $${questionIndex}`);
          questionValues.push(updates[key]);
          questionIndex++;
        }
      }
    });

    if (questionClauses.length === 0 && mappingClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await client.query('BEGIN');

    if (questionClauses.length > 0) {
      questionValues.push(id);
      await client.query(
        `
        UPDATE chuyen_sau_cauhoi
        SET ${questionClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${questionValues.length}
        `,
        questionValues
      );
    }

    if (mappingClauses.length > 0) {
      mappingValues.push(id);
      await client.query(
        `
        UPDATE chuyen_sau_bode_cauhoi
        SET ${mappingClauses.join(', ')}
        WHERE question_id = $${mappingValues.length}
        `,
        mappingValues
      );
    }

    const result = await client.query(
      `
      SELECT q.id
      FROM chuyen_sau_cauhoi q
      WHERE q.id = $1
      `,
      [id]
    );

    await client.query('COMMIT');

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
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    console.error('Error updating exam set question:', error);
    return NextResponse.json(
      { error: 'Failed to update exam set question' },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}

// DELETE: Delete set question
export async function DELETE(request: NextRequest) {
  let client: Awaited<ReturnType<typeof pool.connect>> | null = null;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Question id is required' },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await client.query('BEGIN');

    await client.query('DELETE FROM chuyen_sau_bode_cauhoi WHERE question_id = $1', [id]);
    const result = await client.query(
      `
      DELETE FROM chuyen_sau_cauhoi q
      WHERE q.id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi map
          WHERE map.question_id = q.id
        )
      RETURNING *
      `,
      [id]
    );

    await client.query('COMMIT');

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
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    console.error('Error deleting exam set question:', error);
    return NextResponse.json(
      { error: 'Failed to delete exam set question' },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}

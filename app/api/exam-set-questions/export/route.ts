import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const setId = searchParams.get('set_id');

    if (!setId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu set_id' },
        { status: 400 }
      );
    }

    const questions = await pool.query(
      `SELECT
        q.question_text,
        q.question_type,
        q.correct_answer,
        CASE
          WHEN q.option_a IS NULL AND q.option_b IS NULL AND q.option_c IS NULL AND q.option_d IS NULL THEN NULL
          ELSE jsonb_build_array(q.option_a, q.option_b, q.option_c, q.option_d)
        END AS options,
        COALESCE(sq.points_override, q.points) AS points,
        q.difficulty,
        q.explanation,
        sq.display_order AS order_number
      FROM chuyen_sau_bode_cauhoi sq
      JOIN chuyen_sau_cauhoi q ON q.id = sq.question_id
      WHERE sq.set_id = $1
      ORDER BY sq.display_order ASC`,
      [setId]
    );

    if (questions.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy câu hỏi nào' },
        { status: 404 }
      );
    }

    const headers = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'points',
      'difficulty',
      'explanation',
      'image_url',
    ];

    const rows = questions.rows.map((q: any) => {
      const optionsStr = q.options
        ? (Array.isArray(q.options) ? q.options.join('|') : q.options)
        : '';

      return [
        escapeCsvValue(q.question_text || ''),
        q.question_type || '',
        escapeCsvValue(q.correct_answer || ''),
        escapeCsvValue(optionsStr),
        q.points || 1,
        q.difficulty || 'medium',
        escapeCsvValue(q.explanation || ''),
        '',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const bom = '\uFEFF';
    const csvWithBom = bom + csv;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cau_hoi_bo_de_${setId}_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting exam set questions:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi export câu hỏi' },
      { status: 500 }
    );
  }
}

function escapeCsvValue(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

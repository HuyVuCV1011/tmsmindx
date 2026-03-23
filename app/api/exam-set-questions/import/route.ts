import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const setId = formData.get('set_id') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy file' },
        { status: 400 }
      );
    }

    if (!setId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu set_id' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'File CSV rỗng hoặc không hợp lệ' },
        { status: 400 }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const expectedHeaders = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'points',
      'difficulty',
      'explanation',
      'image_url',
    ];

    const hasAllHeaders = expectedHeaders.every((h) => headers.includes(h));
    if (!hasAllHeaders) {
      return NextResponse.json(
        {
          success: false,
          error: 'Header không đúng định dạng. Vui lòng sử dụng file mẫu.',
          expected: expectedHeaders,
          received: headers,
        },
        { status: 400 }
      );
    }

    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(order_number), 0) as max_order FROM exam_set_questions WHERE set_id = $1',
      [setId]
    );
    let currentOrder = Number(maxOrderResult.rows[0]?.max_order || 0);

    const errors: string[] = [];
    const imported: Array<{ id: number; question_text: string; line: number }> = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every((v) => !v.trim())) {
          continue;
        }

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        if (!row.question_text?.trim()) {
          errors.push(`Dòng ${i + 1}: Thiếu nội dung câu hỏi`);
          continue;
        }

        if (!row.question_type?.trim()) {
          errors.push(`Dòng ${i + 1}: Thiếu loại câu hỏi`);
          continue;
        }

        const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'essay'];
        if (!validTypes.includes(row.question_type)) {
          errors.push(`Dòng ${i + 1}: Loại câu hỏi không hợp lệ (${row.question_type})`);
          continue;
        }

        let optionsArray: string[] | null = null;
        if (row.options?.trim()) {
          optionsArray = row.options
            .split('|')
            .map((opt) => opt.trim())
            .filter(Boolean);
        }

        if (row.question_type === 'multiple_choice' || row.question_type === 'true_false') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`Dòng ${i + 1}: Câu hỏi ${row.question_type} cần ít nhất 2 đáp án`);
            continue;
          }
          if (!row.correct_answer?.trim()) {
            errors.push(`Dòng ${i + 1}: Thiếu đáp án đúng`);
            continue;
          }
          if (!optionsArray.includes(row.correct_answer.trim())) {
            errors.push(`Dòng ${i + 1}: Đáp án đúng không có trong danh sách đáp án`);
            continue;
          }
        }

        const points = parseFloat(row.points || '1');
        if (Number.isNaN(points) || points < 0) {
          errors.push(`Dòng ${i + 1}: Điểm số không hợp lệ`);
          continue;
        }

        currentOrder++;
        const result = await pool.query(
          `INSERT INTO exam_set_questions
          (set_id, question_text, question_type, correct_answer, options, points, explanation, order_number, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING id`,
          [
            setId,
            row.question_text.trim(),
            row.question_type,
            row.correct_answer?.trim() || null,
            optionsArray ? JSON.stringify(optionsArray) : null,
            points,
            row.explanation?.trim() || null,
            currentOrder,
          ]
        );

        imported.push({
          id: result.rows[0].id,
          question_text: row.question_text.trim(),
          line: i + 1,
        });
      } catch (error: any) {
        console.error(`Error parsing line ${i + 1}:`, error);
        errors.push(`Dòng ${i + 1}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import thành công ${imported.length} câu hỏi`,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
      data: imported,
    });
  } catch (error: any) {
    console.error('Error importing exam set questions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi import câu hỏi' },
      { status: 500 }
    );
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

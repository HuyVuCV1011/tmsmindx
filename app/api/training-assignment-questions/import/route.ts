import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const assignmentId = formData.get('assignment_id') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy file' },
        { status: 400 }
      );
    }

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu assignment_id' },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();
    
    // Parse CSV
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'File CSV rỗng hoặc không hợp lệ' },
        { status: 400 }
      );
    }

    // Parse header
    const headers = parseCSVLine(lines[0]);
    const expectedHeaders = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'points',
      'difficulty',
      'explanation',
      'image_url'
    ];

    // Validate headers
    const hasAllHeaders = expectedHeaders.every(h => headers.includes(h));
    if (!hasAllHeaders) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Header không đúng định dạng. Vui lòng sử dụng file mẫu.',
          expected: expectedHeaders,
          received: headers
        },
        { status: 400 }
      );
    }

    // Get current max order_number
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(order_number), 0) as max_order FROM training_assignment_questions WHERE assignment_id = $1',
      [assignmentId]
    );
    let currentOrder = maxOrderResult.rows[0].max_order;

    const errors: string[] = [];
    const imported: any[] = [];

    // Parse and validate each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        if (values.length === 0 || values.every(v => !v.trim())) {
          continue; // Skip empty lines
        }

        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Validate required fields
        if (!row.question_text?.trim()) {
          errors.push(`Dòng ${i + 1}: Thiếu nội dung câu hỏi`);
          continue;
        }

        if (!row.question_type?.trim()) {
          errors.push(`Dòng ${i + 1}: Thiếu loại câu hỏi`);
          continue;
        }

        // Validate question type
        const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'essay'];
        if (!validTypes.includes(row.question_type)) {
          errors.push(`Dòng ${i + 1}: Loại câu hỏi không hợp lệ (${row.question_type}). Chỉ chấp nhận: ${validTypes.join(', ')}`);
          continue;
        }

        // Validate difficulty
        const validDifficulties = ['easy', 'medium', 'hard'];
        if (row.difficulty && !validDifficulties.includes(row.difficulty)) {
          errors.push(`Dòng ${i + 1}: Độ khó không hợp lệ (${row.difficulty}). Chỉ chấp nhận: ${validDifficulties.join(', ')}`);
          continue;
        }

        // Parse options
        let optionsArray: string[] | null = null;
        if (row.options?.trim()) {
          optionsArray = row.options.split('|').map((opt: string) => opt.trim()).filter((opt: string) => opt);
        }

        // Validate based on question type
        if (row.question_type === 'multiple_choice' || row.question_type === 'true_false') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`Dòng ${i + 1}: Câu hỏi ${row.question_type} cần ít nhất 2 đáp án`);
            continue;
          }

          if (!row.correct_answer?.trim()) {
            errors.push(`Dòng ${i + 1}: Thiếu đáp án đúng`);
            continue;
          }

          // Validate correct answer exists in options
          if (!optionsArray.includes(row.correct_answer.trim())) {
            errors.push(`Dòng ${i + 1}: Đáp án đúng "${row.correct_answer}" không có trong danh sách đáp án`);
            continue;
          }
        }

        // Validate points
        const points = parseInt(row.points) || 1;
        if (points < 0) {
          errors.push(`Dòng ${i + 1}: Điểm số không hợp lệ`);
          continue;
        }

        // Insert question
        currentOrder++;
        const result = await pool.query(
          `INSERT INTO training_assignment_questions 
          (assignment_id, question_text, question_type, correct_answer, options, points, difficulty, explanation, image_url, order_number, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          RETURNING id`,
          [
            assignmentId,
            row.question_text.trim(),
            row.question_type,
            row.correct_answer?.trim() || '',
            optionsArray ? JSON.stringify(optionsArray) : null,
            points,
            row.difficulty || 'medium',
            row.explanation?.trim() || '',
            row.image_url?.trim() || null,
            currentOrder
          ]
        );

        imported.push({
          id: result.rows[0].id,
          question_text: row.question_text.trim(),
          line: i + 1
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
      data: imported
    });

  } catch (error: any) {
    console.error('Error importing questions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi import câu hỏi' },
      { status: 500 }
    );
  }
}

// Helper function to parse CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

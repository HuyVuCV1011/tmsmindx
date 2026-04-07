import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Loại bỏ blob/data-url images khỏi HTML content khi lưu vào DB
const stripUnstableImageSources = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.replace(
    /<img[^>]+src=["'](?:blob:[^"']*|data:image[^"']*)[^>]*>/gi,
    ''
  );
};

// ─── GET: Lấy câu hỏi của một bộ đề theo set_id ──────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('set_id');

    if (!setId) {
      return NextResponse.json({ error: 'set_id is required' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT
         cq.id,
         bc.id_de                                           AS assignment_id,
         cq.noi_dung_cau_hoi                               AS question_text,
         cq.loai_cau_hoi                                   AS question_type,
         COALESCE(cq.dap_an_dung, '')                      AS correct_answer,
         CASE
           WHEN cq.lua_chon_a IS NULL AND cq.lua_chon_b IS NULL
            AND cq.lua_chon_c IS NULL AND cq.lua_chon_d IS NULL THEN NULL
           ELSE jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
         END                                               AS options,
         COALESCE(cq.giai_thich, '')                       AS explanation,
         cq.diem                                           AS points,
         bc.thu_tu_hien_thi                                AS order_number,
         COALESCE(cq.do_kho, 'trung_binh')                 AS difficulty,
         bd.ma_de                                          AS set_code,
         bd.ten_de                                         AS set_name,
         mh.ten_mon                                        AS subject_name
       FROM chuyen_sau_bode_cauhoi bc
       JOIN chuyen_sau_cauhoi cq ON cq.id = bc.id_cau
       JOIN chuyen_sau_bode bd   ON bd.id = bc.id_de
       JOIN chuyen_sau_monhoc mh ON mh.id = bd.id_mon
       WHERE bc.id_de = $1
       ORDER BY bc.thu_tu_hien_thi ASC`,
      [setId]
    );

    return NextResponse.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching exam set questions:', error);
    return NextResponse.json({ error: 'Failed to fetch exam set questions' }, { status: 500 });
  }
}

// ─── POST: Thêm câu hỏi mới vào bộ đề ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const {
      set_id,
      question_text,
      question_type = 'trac_nghiem',
      correct_answer,
      options,
      explanation,
      points = 1,
      order_number,
      difficulty = 'trung_binh',
    } = body;

    if (!set_id) {
      return NextResponse.json({ error: 'set_id is required' }, { status: 400 });
    }

    const sanitizedText = String(stripUnstableImageSources(question_text) || '');
    const normalizedText = sanitizedText.trim() || '[Chưa có nội dung]';
    const sanitizedCorrectAnswer = correct_answer == null ? null : String(stripUnstableImageSources(correct_answer) || '');
    const sanitizedExplanation = explanation == null ? null : String(stripUnstableImageSources(explanation) || '');
    const sanitizedOptions = Array.isArray(options)
      ? options.map((item) => String(stripUnstableImageSources(item) || '')).filter(Boolean)
      : [];

    await client.query('BEGIN');

    const questionResult = await client.query(
      `INSERT INTO chuyen_sau_cauhoi (
         loai_cau_hoi, noi_dung_cau_hoi,
         lua_chon_a, lua_chon_b, lua_chon_c, lua_chon_d,
         dap_an_dung, giai_thich, diem, do_kho
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        question_type === 'essay' ? 'tu_luan' : question_type,
        normalizedText,
        sanitizedOptions[0] || null,
        sanitizedOptions[1] || null,
        sanitizedOptions[2] || null,
        sanitizedOptions[3] || null,
        sanitizedCorrectAnswer,
        sanitizedExplanation,
        Number(points || 1),
        ['de', 'trung_binh', 'kho'].includes(difficulty) ? difficulty : 'trung_binh',
      ]
    );
    const questionId = questionResult.rows[0].id;

    await client.query(
      `INSERT INTO chuyen_sau_bode_cauhoi (id_de, id_cau, thu_tu_hien_thi)
       VALUES ($1, $2, $3)`,
      [set_id, questionId, Number(order_number || 1)]
    );

    await client.query('COMMIT');

    const resultRow = await pool.query(
      `SELECT
         cq.id,
         bc.id_de AS assignment_id,
         cq.noi_dung_cau_hoi AS question_text,
         cq.loai_cau_hoi AS question_type,
         cq.dap_an_dung AS correct_answer,
         CASE
           WHEN cq.lua_chon_a IS NULL AND cq.lua_chon_b IS NULL
            AND cq.lua_chon_c IS NULL AND cq.lua_chon_d IS NULL THEN NULL
           ELSE jsonb_build_array(cq.lua_chon_a, cq.lua_chon_b, cq.lua_chon_c, cq.lua_chon_d)
         END AS options,
         cq.giai_thich AS explanation,
         cq.diem AS points,
         bc.thu_tu_hien_thi AS order_number,
         cq.do_kho AS difficulty
       FROM chuyen_sau_cauhoi cq
       JOIN chuyen_sau_bode_cauhoi bc ON bc.id_cau = cq.id
       WHERE cq.id = $1`,
      [questionId]
    );

    return NextResponse.json(
      { success: true, data: resultRow.rows[0], message: 'Exam set question created successfully' },
      { status: 201 }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating exam set question:', error);
    return NextResponse.json({ error: 'Failed to create exam set question' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ─── PUT: Cập nhật câu hỏi ───────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  let client: any = null;
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Question id is required' }, { status: 400 });
    }

    const allowedFields = [
      'question_text', 'question_type', 'correct_answer',
      'options', 'explanation', 'points', 'order_number', 'difficulty',
    ];

    const questionClauses: string[] = [];
    const questionValues: unknown[] = [];
    const mappingClauses: string[] = [];
    const mappingValues: unknown[] = [];

    Object.keys(updates).forEach((key) => {
      if (!allowedFields.includes(key)) return;

      if (key === 'order_number') {
        mappingClauses.push(`thu_tu_hien_thi = $${mappingValues.length + 1}`);
        mappingValues.push(Number(updates[key] || 1));
        return;
      }
      if (key === 'points') {
        questionClauses.push(`diem = $${questionValues.length + 1}`);
        questionValues.push(Number(updates[key] || 1));
        return;
      }
      if (key === 'options') {
        const sanitized = Array.isArray(updates[key])
          ? updates[key].map((item: unknown) => String(stripUnstableImageSources(item) || '')).filter(Boolean)
          : [];
        const fields = ['lua_chon_a', 'lua_chon_b', 'lua_chon_c', 'lua_chon_d'] as const;
        fields.forEach((field, idx) => {
          questionClauses.push(`${field} = $${questionValues.length + 1}`);
          questionValues.push(sanitized[idx] || null);
        });
        return;
      }
      if (key === 'question_text') {
        questionClauses.push(`noi_dung_cau_hoi = $${questionValues.length + 1}`);
        questionValues.push(stripUnstableImageSources(updates[key]));
        return;
      }
      if (key === 'correct_answer') {
        questionClauses.push(`dap_an_dung = $${questionValues.length + 1}`);
        questionValues.push(stripUnstableImageSources(updates[key]));
        return;
      }
      if (key === 'explanation') {
        questionClauses.push(`giai_thich = $${questionValues.length + 1}`);
        questionValues.push(stripUnstableImageSources(updates[key]));
        return;
      }
      if (key === 'question_type') {
        questionClauses.push(`loai_cau_hoi = $${questionValues.length + 1}`);
        questionValues.push(updates[key] === 'essay' ? 'tu_luan' : updates[key]);
        return;
      }
      if (key === 'difficulty') {
        questionClauses.push(`do_kho = $${questionValues.length + 1}`);
        questionValues.push(updates[key]);
        return;
      }
    });

    if (questionClauses.length === 0 && mappingClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    if (questionClauses.length > 0) {
      questionValues.push(id);
      await client.query(
        `UPDATE chuyen_sau_cauhoi SET ${questionClauses.join(', ')} WHERE id = $${questionValues.length}`,
        questionValues
      );
    }
    if (mappingClauses.length > 0) {
      mappingValues.push(id);
      await client.query(
        `UPDATE chuyen_sau_bode_cauhoi SET ${mappingClauses.join(', ')} WHERE id_cau = $${mappingValues.length}`,
        mappingValues
      );
    }

    const result = await client.query(`SELECT id FROM chuyen_sau_cauhoi WHERE id = $1`, [id]);
    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Exam set question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0], message: 'Exam set question updated successfully' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error updating exam set question:', error);
    return NextResponse.json({ error: 'Failed to update exam set question' }, { status: 500 });
  } finally {
    client?.release();
  }
}

// ─── DELETE: Xóa câu hỏi và mapping ─────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  let client: any = null;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Question id is required' }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Xóa mapping trước (id_cau là FK)
    await client.query('DELETE FROM chuyen_sau_bode_cauhoi WHERE id_cau = $1', [id]);

    const result = await client.query(
      `DELETE FROM chuyen_sau_cauhoi cq
       WHERE cq.id = $1
         AND NOT EXISTS (
           SELECT 1 FROM chuyen_sau_bode_cauhoi bc WHERE bc.id_cau = cq.id
         )
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Exam set question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Exam set question deleted successfully' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error deleting exam set question:', error);
    return NextResponse.json({ error: 'Failed to delete exam set question' }, { status: 500 });
  } finally {
    client?.release();
  }
}

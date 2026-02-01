import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: Lấy danh sách giải thích
// Query params: email (để lọc theo user), status (để lọc theo trạng thái)
export async function GET(request: Request) {
  let client;
  
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    
    client = await pool.connect();
    
    let query = 'SELECT * FROM explanations';
    const conditions = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (email) {
      conditions.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }
    
    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await client.query(query, values);
    
    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
    
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
    
  } finally {
    if (client) {
      client.release();
    }
  }
}

// POST: Tạo giải thích mới
export async function POST(request: Request) {
  let client;
  
  try {
    const body = await request.json();
    const {
      teacher_name,
      lms_code,
      email,
      campus,
      subject,
      test_date,
      reason
    } = body;
    
    // Validate required fields
    if (!teacher_name || !lms_code || !email || !campus || !subject || !test_date || !reason) {
      return NextResponse.json({
        success: false,
        error: 'Vui lòng điền đầy đủ thông tin'
      }, { status: 400 });
    }
    
    client = await pool.connect();
    
    const query = `
      INSERT INTO explanations (
        teacher_name, lms_code, email, campus, subject, test_date, reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `;
    
    const values = [teacher_name, lms_code, email, campus, subject, test_date, reason];
    const result = await client.query(query, values);
    
    // Gửi email thông báo
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-explanation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new',
          explanation: result.rows[0]
        })
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Không throw error, vẫn trả về thành công
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tạo giải thích thành công',
      data: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
    
  } finally {
    if (client) {
      client.release();
    }
  }
}

// PATCH: Cập nhật trạng thái giải thích (admin)
export async function PATCH(request: Request) {
  let client;
  
  try {
    const body = await request.json();
    const { id, status, admin_note, admin_email, admin_name } = body;
    
    if (!id || !status) {
      return NextResponse.json({
        success: false,
        error: 'Thiếu thông tin bắt buộc'
      }, { status: 400 });
    }
    
    if (!['accepted', 'rejected'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Trạng thái không hợp lệ'
      }, { status: 400 });
    }
    
    client = await pool.connect();
    
    const query = `
      UPDATE explanations 
      SET status = $1, admin_note = $2, admin_email = $3, admin_name = $4
      WHERE id = $5
      RETURNING *
    `;
    
    const values = [status, admin_note, admin_email, admin_name, id];
    const result = await client.query(query, values);
    
    if (result.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Không tìm thấy giải thích'
      }, { status: 404 });
    }
    
    // Gửi email thông báo cho giáo viên
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-explanation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: status === 'accepted' ? 'accepted' : 'rejected',
          explanation: result.rows[0]
        })
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Đã ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} giải thích`,
      data: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
    
  } finally {
    if (client) {
      client.release();
    }
  }
}

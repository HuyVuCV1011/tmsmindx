import pool from '@/lib/db';
import { NextResponse } from 'next/server';

type LeaveStatus =
  | 'pending_admin'
  | 'approved_unassigned'
  | 'approved_assigned'
  | 'rejected'
  | 'substitute_confirmed';

const VALID_STATUS: LeaveStatus[] = [
  'pending_admin',
  'approved_unassigned',
  'approved_assigned',
  'rejected',
  'substitute_confirmed'
];

export async function GET(request: Request) {
  let client;

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const mode = searchParams.get('mode');
    const status = searchParams.get('status');

    client = await pool.connect();

    let query = 'SELECT * FROM leave_requests';
    const conditions: string[] = [];
    const values: Array<string> = [];
    let idx = 1;

    if (mode === 'admin') {
      // Admin sees all records.
    } else if (mode === 'substitute' && email) {
      conditions.push(`LOWER(substitute_email) = LOWER($${idx})`);
      values.push(email);
      idx += 1;
    } else if (email) {
      conditions.push(`LOWER(email) = LOWER($${idx})`);
      values.push(email);
      idx += 1;
    }

    if (status && VALID_STATUS.includes(status as LeaveStatus)) {
      conditions.push(`status = $${idx}`);
      values.push(status);
      idx += 1;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await client.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error: any) {
    console.error('leave-requests GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Có lỗi xảy ra khi lấy dữ liệu'
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

export async function POST(request: Request) {
  let client;

  try {
    const body = await request.json();

    const {
      teacher_name,
      lms_code,
      email,
      campus,
      leave_date,
      reason,
      class_code,
      student_count,
      class_time,
      leave_session,
      has_substitute,
      substitute_teacher,
      substitute_email,
      class_status,
      email_subject,
      email_body
    } = body;

    if (!teacher_name || !lms_code || !email || !campus || !leave_date || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng điền đầy đủ thông tin bắt buộc'
        },
        { status: 400 }
      );
    }

    const normalizedHasSubstitute = Boolean(has_substitute);

    client = await pool.connect();

    const insertQuery = `
      INSERT INTO leave_requests (
        teacher_name,
        lms_code,
        email,
        campus,
        leave_date,
        reason,
        class_code,
        student_count,
        class_time,
        leave_session,
        has_substitute,
        substitute_teacher,
        substitute_email,
        class_status,
        email_subject,
        email_body,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, 'pending_admin'
      )
      RETURNING *
    `;

    const values = [
      teacher_name,
      lms_code,
      email,
      campus,
      leave_date,
      reason,
      class_code || null,
      student_count || null,
      class_time || null,
      leave_session || null,
      normalizedHasSubstitute,
      substitute_teacher || null,
      substitute_email || null,
      class_status || null,
      email_subject || null,
      email_body || null
    ];

    const result = await client.query(insertQuery, values);

    return NextResponse.json({
      success: true,
      message: 'Tạo yêu cầu xin nghỉ thành công',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('leave-requests POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Có lỗi xảy ra khi tạo yêu cầu'
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

export async function PATCH(request: Request) {
  let client;

  try {
    const body = await request.json();
    const { action, id } = body;

    if (!id || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thiếu thông tin bắt buộc'
        },
        { status: 400 }
      );
    }

    client = await pool.connect();

    if (action === 'admin_review') {
      const {
        decision,
        admin_note,
        admin_email,
        admin_name,
        substitute_teacher,
        substitute_email
      } = body;

      if (!['approved', 'rejected'].includes(decision)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Quyết định duyệt không hợp lệ'
          },
          { status: 400 }
        );
      }

      if (decision === 'rejected') {
        const rejectedQuery = `
          UPDATE leave_requests
          SET
            status = 'rejected',
            admin_note = $1,
            admin_email = $2,
            admin_name = $3
          WHERE id = $4
          RETURNING *
        `;

        const rejectedResult = await client.query(rejectedQuery, [admin_note || null, admin_email || null, admin_name || null, id]);

        if (rejectedResult.rowCount === 0) {
          return NextResponse.json({ success: false, error: 'Không tìm thấy yêu cầu' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: rejectedResult.rows[0] });
      }

      const hasAssignedSubstitute = Boolean(substitute_teacher || substitute_email);
      const approvedStatus: LeaveStatus = hasAssignedSubstitute ? 'approved_assigned' : 'approved_unassigned';

      const approvedQuery = `
        UPDATE leave_requests
        SET
          status = $1,
          admin_note = $2,
          admin_email = $3,
          admin_name = $4,
          substitute_teacher = COALESCE($5, substitute_teacher),
          substitute_email = COALESCE($6, substitute_email)
        WHERE id = $7
        RETURNING *
      `;

      const approvedResult = await client.query(approvedQuery, [
        approvedStatus,
        admin_note || null,
        admin_email || null,
        admin_name || null,
        substitute_teacher || null,
        substitute_email || null,
        id
      ]);

      if (approvedResult.rowCount === 0) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy yêu cầu' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: approvedResult.rows[0] });
    }

    if (action === 'assign_substitute') {
      const { substitute_teacher, substitute_email, admin_email, admin_name } = body;

      if (!substitute_teacher && !substitute_email) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng nhập giáo viên thay thế'
          },
          { status: 400 }
        );
      }

      const assignQuery = `
        UPDATE leave_requests
        SET
          status = 'approved_assigned',
          substitute_teacher = $1,
          substitute_email = $2,
          admin_email = COALESCE($3, admin_email),
          admin_name = COALESCE($4, admin_name)
        WHERE id = $5
        RETURNING *
      `;

      const assignResult = await client.query(assignQuery, [
        substitute_teacher || null,
        substitute_email || null,
        admin_email || null,
        admin_name || null,
        id
      ]);

      if (assignResult.rowCount === 0) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy yêu cầu' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: assignResult.rows[0] });
    }

    if (action === 'substitute_confirm') {
      const { substitute_email } = body;

      const confirmQuery = `
        UPDATE leave_requests
        SET
          status = 'substitute_confirmed',
          substitute_confirmed_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND status = 'approved_assigned'
          AND LOWER(substitute_email) = LOWER($2)
        RETURNING *
      `;

      const confirmResult = await client.query(confirmQuery, [id, substitute_email || '']);

      if (confirmResult.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Không tìm thấy yêu cầu phù hợp để xác nhận'
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: confirmResult.rows[0] });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Action không hợp lệ'
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('leave-requests PATCH error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Có lỗi xảy ra khi cập nhật yêu cầu'
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

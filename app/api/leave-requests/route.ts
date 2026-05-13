import { requireBearerDbRoles } from '@/lib/auth-server';
import { normalizeText as normalizeCampusText } from '@/lib/campus-data';
import { getAccessibleCenters } from '@/lib/center-access';
import {
    rejectIfEmailNotSelf,
    requireBearerSession,
} from '@/lib/datasource-api-auth';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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

type AccessibleCenter = {
  id: number;
  full_name: string;
  short_code: string | null;
  region: string | null;
};

function normalizeCampusKey(value: unknown): string {
  return normalizeCampusText(String(value ?? ''));
}

function buildAccessibleCampusKeys(centers: AccessibleCenter[]): string[] {
  const keys = new Set<string>();

  for (const center of centers) {
    const candidates = [
      center.full_name,
      center.short_code ?? '',
    ];

    for (const candidate of candidates) {
      const key = normalizeCampusKey(candidate);
      if (key) keys.add(key);
    }
  }

  return Array.from(keys);
}

function campusIsAccessible(
  campus: string | null | undefined,
  allowedCampusKeys: string[],
): boolean {
  if (allowedCampusKeys.length === 0) return false;
  const campusKey = normalizeCampusKey(campus);
  if (!campusKey) return false;
  return allowedCampusKeys.includes(campusKey);
}

async function getAllowedCampusKeysForSession(
  sessionEmail: string,
  privileged: boolean,
): Promise<string[]> {
  if (privileged) return [];
  const centers = await getAccessibleCenters(sessionEmail);
  return buildAccessibleCampusKeys(centers as AccessibleCenter[]);
}

async function rejectIfLeaveRequestNotAccessible(
  sessionEmail: string,
  privileged: boolean,
  id: string | number,
): Promise<NextResponse | null> {
  if (privileged) return null;

  const targetId = Number(id);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return NextResponse.json(
      { success: false, error: 'Yêu cầu không hợp lệ' },
      { status: 400 },
    );
  }

  const requestResult = await pool.query(
    'SELECT campus FROM leave_requests WHERE id = $1 LIMIT 1',
    [targetId],
  );

  if (requestResult.rowCount === 0) {
    return NextResponse.json(
      { success: false, error: 'Không tìm thấy yêu cầu' },
      { status: 404 },
    );
  }

  const allowedCampusKeys = await getAllowedCampusKeysForSession(
    sessionEmail,
    privileged,
  );

  if (!campusIsAccessible(requestResult.rows[0]?.campus, allowedCampusKeys)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Không có quyền xử lý yêu cầu thuộc cơ sở này',
      },
      { status: 403 },
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  let client;

  try {
    const { searchParams } = request.nextUrl;
    const mode = searchParams.get('mode');

    if (mode === 'admin') {
      const gate = await requireBearerDbRoles(request, [
        'super_admin',
        'admin',
        'manager',
      ]);
      if (!gate.ok) return gate.response;

      const allowedCampusKeys = await getAllowedCampusKeysForSession(
        gate.sessionEmail,
        gate.role === 'super_admin',
      );
      if (gate.role !== 'super_admin' && allowedCampusKeys.length === 0) {
        console.log('[leave-requests admin] no allowed campuses', {
          sessionEmail: gate.sessionEmail,
          role: gate.role,
        })

        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
        });
      }

      client = await pool.connect();

      let query = 'SELECT * FROM leave_requests';
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const status = searchParams.get('status');
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
      const visibleRows =
        gate.role === 'super_admin'
          ? result.rows
          : result.rows.filter((row) =>
              campusIsAccessible(row?.campus, allowedCampusKeys),
            )

      console.log('[leave-requests admin] resolved rows', {
        sessionEmail: gate.sessionEmail,
        role: gate.role,
        allowedCampusKeys,
        dbRowCount: result.rowCount,
        visibleRowCount: visibleRows.length,
      })

      return NextResponse.json({
        success: true,
        data: visibleRows,
        count: visibleRows.length,
      });
    }

    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const email = searchParams.get('email');
    const status = searchParams.get('status');

    if (mode === 'substitute' && email) {
      const denied = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        email,
      );
      if (denied) return denied;
    } else if (email) {
      const denied = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        email,
      );
      if (denied) return denied;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Cần email hoặc mode=admin với quyền quản trị',
        },
        { status: 400 },
      );
    }

    client = await pool.connect();

    let query = 'SELECT * FROM leave_requests';
    const conditions: string[] = [];
    const values: Array<string> = [];
    let idx = 1;

    if (mode === 'substitute' && email) {
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

export async function POST(request: NextRequest) {
  let client;

  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

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

    const denied = rejectIfEmailNotSelf(
      auth.sessionEmail,
      auth.privileged,
      String(email),
    );
    if (denied) return denied;

    const trimmedClassCode = typeof class_code === 'string' ? class_code.trim() : '';
    if (!trimmedClassCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng nhập mã lớp để tạo yêu cầu (tối đa 2 yêu cầu cho mỗi mã lớp).'
        },
        { status: 400 }
      );
    }

    const trimmedClassTime =
      typeof class_time === 'string' ? class_time.trim() : '';
    const trimmedLeaveSession =
      typeof leave_session === 'string' ? leave_session.trim() : '';
    if (!trimmedClassTime || !trimmedLeaveSession) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng điền đầy đủ thời gian học và buổi học xin nghỉ.'
        },
        { status: 400 }
      );
    }

    const normalizedHasSubstitute = Boolean(has_substitute);

    client = await pool.connect();

    const countSameClass = await client.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM leave_requests
      WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
        AND LOWER(TRIM(class_code)) = LOWER(TRIM($2))
      `,
      [email, trimmedClassCode]
    );

    const existingForClass = countSameClass.rows[0]?.cnt ?? 0;
    if (existingForClass >= 2) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Mỗi mã lớp chỉ được tạo tối đa 2 yêu cầu xin nghỉ. Bạn đã đạt giới hạn cho mã lớp này.'
        },
        { status: 400 }
      );
    }

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
      trimmedClassCode,
      student_count || null,
      trimmedClassTime,
      trimmedLeaveSession,
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

export async function PATCH(request: NextRequest) {
  let client;

  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

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

    if (action === 'admin_review') {
      const gate = await requireBearerDbRoles(request, [
        'super_admin',
        'admin',
        'manager',
      ]);
      if (!gate.ok) return gate.response;

      const campusDenied = await rejectIfLeaveRequestNotAccessible(
        gate.sessionEmail,
        gate.role === 'super_admin',
        id,
      );
      if (campusDenied) return campusDenied;

      const sessionAdminEmail = gate.sessionEmail;
      const {
        decision,
        admin_note,
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

      client = await pool.connect();

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

        const rejectedResult = await client.query(rejectedQuery, [
          admin_note || null,
          sessionAdminEmail,
          admin_name || null,
          id,
        ]);

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
        sessionAdminEmail,
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
      const gate = await requireBearerDbRoles(request, [
        'super_admin',
        'admin',
        'manager',
      ]);
      if (!gate.ok) return gate.response;
      const campusDenied = await rejectIfLeaveRequestNotAccessible(
        gate.sessionEmail,
        gate.role === 'super_admin',
        id,
      );
      if (campusDenied) return campusDenied;

      const sessionAdminEmail = gate.sessionEmail;

      const { substitute_teacher, substitute_email, admin_name } = body;

      if (!substitute_teacher && !substitute_email) {
        return NextResponse.json(
          {
            success: false,
            error: 'Vui lòng nhập giáo viên thay thế'
          },
          { status: 400 }
        );
      }

      client = await pool.connect();

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
        sessionAdminEmail,
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
      const sub = String(substitute_email || '').trim().toLowerCase();
      const denied = rejectIfEmailNotSelf(auth.sessionEmail, false, sub);
      if (denied) return denied;

      client = await pool.connect();

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

      const confirmedRow = confirmResult.rows[0];

      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'leave_approved_substitute_confirmed',
            data: {
              teacher_name: confirmedRow.teacher_name,
              teacher_email: confirmedRow.email,
              campus: confirmedRow.campus,
              class_code: confirmedRow.class_code,
              leave_date: confirmedRow.leave_date,
              class_time: confirmedRow.class_time,
              leave_session: confirmedRow.leave_session,
              substitute_teacher: confirmedRow.substitute_teacher,
              substitute_email: confirmedRow.substitute_email,
              reason: confirmedRow.reason,
              admin_note: confirmedRow.admin_note,
              admin_name: confirmedRow.admin_name,
              admin_email: confirmedRow.admin_email,
              substitute_confirmed_at: confirmedRow.substitute_confirmed_at,
            },
          }),
        });
      } catch (mailError) {
        console.error('leave-requests substitute_confirm email error:', mailError);
      }

      return NextResponse.json({ success: true, data: confirmedRow });
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

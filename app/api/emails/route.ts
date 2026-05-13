import { NextResponse } from 'next/server';
import { renderTemplate } from './render';
import { sendMail } from './transporter';

const BU_EMAIL = 'baotc@mindx.com.vn';

type LeaveApprovedPayload = {
  teacher_name: string;
  teacher_email: string;
  campus?: string;
  class_code?: string;
  leave_date?: string;
  class_time?: string;
  leave_session?: string;
  substitute_teacher?: string;
  substitute_email?: string;
  reason?: string;
  admin_note?: string;
  admin_name?: string;
  admin_email?: string;
  substitute_confirmed_at?: string;
};

function formatDateTime(input?: string) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString('vi-VN');
}

function formatDate(input?: string) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString('vi-VN');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body as {
      type?: string;
      data?: LeaveApprovedPayload;
    };

    if (type !== 'leave_approved_substitute_confirmed') {
      return NextResponse.json(
        { success: false, error: 'Unsupported email type' },
        { status: 400 },
      );
    }

    if (!data?.teacher_name || !data?.teacher_email || !data?.substitute_email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: teacher_name, teacher_email, substitute_email',
        },
        { status: 400 },
      );
    }

    const html = renderTemplate('leave-approved-substitute-confirmed', {
      teacher_name: data.teacher_name,
      teacher_email: data.teacher_email,
      campus: data.campus,
      class_code: data.class_code,
      leave_date: formatDate(data.leave_date),
      class_time: data.class_time,
      leave_session: data.leave_session,
      substitute_teacher: data.substitute_teacher,
      substitute_email: data.substitute_email,
      reason: data.reason,
      admin_note: data.admin_note,
      admin_name: data.admin_name,
      admin_email: data.admin_email,
      substitute_confirmed_at: formatDateTime(data.substitute_confirmed_at),
    });

    const tcEmails = [data.admin_email].filter(Boolean) as string[];
    const to = [...new Set([...tcEmails, BU_EMAIL])];

    const sendResult = await sendMail({
      to,
      cc: data.substitute_email,
      subject: `[MindX | Xin nghỉ 1 buổi] Đã duyệt & GV thay đã xác nhận - ${data.teacher_name}`,
      html,
    });

    return NextResponse.json({
      success: true,
      sent: sendResult.sent,
      warning: sendResult.warning,
      recipients: { to, cc: data.substitute_email },
    });
  } catch (error: any) {
    console.error('[emails/route] error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

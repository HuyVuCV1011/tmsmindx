import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { renderEmailTemplate } from './email-templates';

// Kiểm tra Gmail credentials - support cả hai naming conventions
const GMAIL_USER = process.env.GMAIL_USER || process.env.MAILDEV_INCOMING_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || process.env.MAILDEV_INCOMING_PASS;

// Tạo transporter với Gmail (chỉ khi có credentials)
let transporter: nodemailer.Transporter | null = null;

if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD
    }
  });
  console.log('✅ Gmail transporter configured successfully');
} else {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ GMAIL CREDENTIALS NOT CONFIGURED');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('⚠️  Email functionality is DISABLED');
  console.error('📧 Giải trình emails will NOT be sent');
  console.error('');
  console.error('🛠️  To fix this:');
  console.error('   1. Create .env.local file in root directory');
  console.error('   2. Add GMAIL_USER and GMAIL_APP_PASSWORD');
  console.error('   3. Restart the dev server');
  console.error('');
  console.error('📖 See EMAIL_CONFIGURATION_GUIDE.md for details');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, explanation } = body;
    
    // Nếu không có transporter, log và trả về success (để app vẫn hoạt động)
    if (!transporter) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ EMAIL NOT SENT - No Gmail Configuration');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('📧 Email type:', type);
      console.error('👤 Teacher:', explanation.teacher_name);
      console.error('📨 Email:', explanation.email);
      console.error('🆔 Explanation ID:', explanation.id);
      console.error('');
      console.error('⚠️  Configure Gmail to enable email notifications');
      console.error('📖 See EMAIL_CONFIGURATION_GUIDE.md');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return NextResponse.json({
        success: true,
        message: 'Yêu cầu đã được xử lý nhưng email chưa được gửi (thiếu cấu hình Gmail)',
        warning: 'GMAIL_CREDENTIALS_NOT_CONFIGURED',
        emailNotSent: true
      });
    }
    
    let mailOptions;
    
    if (type === 'new') {
      // Email khi giáo viên tạo giải trình mới
      const htmlContent = renderEmailTemplate('new-explanation', {
        teacher_name: explanation.teacher_name,
        lms_code: explanation.lms_code,
        email: explanation.email,
        campus: explanation.campus,
        subject: explanation.subject,
        test_date: explanation.test_date,
        reason: explanation.reason,
        created_at: explanation.created_at
      });
      
      mailOptions = {
        from: GMAIL_USER,
        to: 'baotc@mindx.com.vn',
        cc: explanation.email,
        subject: '[MindX | Teaching] V/v không tham gia kiểm tra',
        html: htmlContent
      };
    } else if (type === 'accepted') {
      // Email khi admin chấp nhận giải trình
      const htmlContent = renderEmailTemplate('accepted-explanation', {
        teacher_name: explanation.teacher_name,
        email: explanation.email,
        campus: explanation.campus,
        subject: explanation.subject,
        test_date: explanation.test_date,
        admin_name: explanation.admin_name,
        admin_email: explanation.admin_email,
        admin_note: explanation.admin_note,
        updated_at: explanation.updated_at
      });
      
      mailOptions = {
        from: GMAIL_USER,
        to: explanation.email,
        cc: 'baotc@mindx.com.vn',
        subject: '[MindX | Teaching] Thông báo: Giải trình được chấp nhận',
        html: htmlContent
      };
    } else if (type === 'rejected') {
      // Email khi admin từ chối giải trình
      const htmlContent = renderEmailTemplate('rejected-explanation', {
        teacher_name: explanation.teacher_name,
        email: explanation.email,
        campus: explanation.campus,
        subject: explanation.subject,
        test_date: explanation.test_date,
        admin_name: explanation.admin_name,
        admin_email: explanation.admin_email,
        admin_note: explanation.admin_note,
        updated_at: explanation.updated_at
      });
      
      mailOptions = {
        from: GMAIL_USER,
        to: explanation.email,
        cc: 'baotc@mindx.com.vn',
        subject: '[MindX | Teaching] Thông báo: Giải trình không được chấp nhận',
        html: htmlContent
      };
    }
    
    // Kiểm tra mailOptions được khởi tạo
    if (!mailOptions) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email type'
      }, { status: 400 });
    }
    
    // Gửi email
    await transporter.sendMail(mailOptions);
    
    return NextResponse.json({
      success: true,
      message: 'Email đã được gửi thành công'
    });
    
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

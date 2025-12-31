import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { renderEmailTemplate } from './email-templates';

// Kiểm tra Gmail credentials
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

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
} else {
  console.warn('⚠️ Gmail credentials not configured. Email functionality will be disabled.');
  console.warn('Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, explanation } = body;
    
    // Nếu không có transporter, log và trả về success (để app vẫn hoạt động)
    if (!transporter) {
      console.warn('⚠️ Email not sent - Gmail credentials not configured');
      console.log('Email type:', type);
      console.log('Explanation details:', {
        id: explanation.id,
        teacher: explanation.teacher_name,
        email: explanation.email
      });
      
      return NextResponse.json({
        success: true,
        message: 'Email không được gửi do thiếu cấu hình Gmail (xem console)',
        warning: 'Gmail credentials not configured'
      });
    }
    
    let mailOptions;
    
    if (type === 'new') {
      // Email khi giáo viên tạo giải thích mới
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
        to: 'academick12@mindx.com.vn',
        cc: explanation.email,
        subject: '[MindX | Teaching] V/v không tham gia kiểm tra',
        html: htmlContent
      };
    } else if (type === 'accepted') {
      // Email khi admin chấp nhận giải thích
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
        cc: 'academick12@mindx.com.vn',
        subject: '[MindX | Teaching] Thông báo: Giải thích được chấp nhận',
        html: htmlContent
      };
    } else if (type === 'rejected') {
      // Email khi admin từ chối giải thích
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
        cc: 'academick12@mindx.com.vn',
        subject: '[MindX | Teaching] Thông báo: Giải thích không được chấp nhận',
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

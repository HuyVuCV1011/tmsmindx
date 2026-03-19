import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

export async function POST(request: NextRequest) {
  try {
    const { email, password, role } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email và password là bắt buộc' },
        { status: 400 }
      );
    }

    // Call Firebase Authentication API
    const response = await fetch(FIREBASE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
        clientType: 'CLIENT_TYPE_WEB',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle Firebase errors
      let errorMessage = 'Đăng nhập thất bại';
      
      if (data.error) {
        switch (data.error.message) {
          case 'EMAIL_NOT_FOUND':
          case 'INVALID_PASSWORD':
          case 'INVALID_LOGIN_CREDENTIALS':
            errorMessage = 'Email hoặc mật khẩu không chính xác';
            break;
          case 'USER_DISABLED':
            errorMessage = 'Tài khoản đã bị vô hiệu hóa';
            break;
          case 'TOO_MANY_ATTEMPTS_TRY_LATER':
            errorMessage = 'Quá nhiều lần thử. Vui lòng thử lại sau';
            break;
          default:
            errorMessage = data.error.message;
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    // Fallback to our local database's display_name if Firebase doesn't provide one
    let finalDisplayName = data.displayName;
    if (!finalDisplayName) {
      try {
        const dbUser = await pool.query('SELECT display_name FROM app_users WHERE email = $1 LIMIT 1', [email.trim().toLowerCase()]);
        if (dbUser.rows.length > 0 && dbUser.rows[0].display_name) {
          finalDisplayName = dbUser.rows[0].display_name;
        }
      } catch (dbErr) {
        console.error('Lỗi lấy tên hiển thị từ local db:', dbErr);
      }
    }

    // Return user data and token
    return NextResponse.json({
      idToken: data.idToken,
      email: data.email,
      localId: data.localId,
      displayName: finalDisplayName || email.split('@')[0],
      expiresIn: data.expiresIn,
      refreshToken: data.refreshToken,
      role: role,
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi server. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const DOMAIN_SUFFIXES = ['@mindx.edu.vn', '@mindx.net.vn', '@mindx.com.vn'];
// Helper function to retry Firebase login
async function tryFirebaseLogin(email: string, password: string) {
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
    return { ok: response.ok, data };
}

export async function POST(request: NextRequest) {
  try {
    const { email: rawEmail, password, role } = await request.json();

    // Validate input
    if (!rawEmail || !password) {
      return NextResponse.json(
        { error: 'Email và password là bắt buộc' },
        { status: 400 }
      );
    }

    const inputEmail = rawEmail.trim();
    let emailsToTry = [inputEmail];

    // If input is just username (no @), try possible domains
    if (!inputEmail.includes('@')) {
      emailsToTry = DOMAIN_SUFFIXES.map(suffix => `${inputEmail}${suffix}`);
    }

    let successData: any = null;
    let lastError: string | null = null;
    let finalDisplayName = null;

    // Try authentication for each possible email
    for (const tryEmail of emailsToTry) {
        try {
            const { ok, data } = await tryFirebaseLogin(tryEmail, password);

            if (ok) {
                // Login successful!
                successData = data;
                break; 
            } else {
                // Collect error
                if (data.error && data.error.message) {
                    lastError = data.error.message;
                } else {
                    lastError = 'LOGIN_FAILED';
                }
            }
        } catch (e) {
            console.error('Firebase Auth internal error', e);
        }
    }

    if (!successData) {
      // Handle Firebase errors (from last attempt or best guess)
      let errorMessage = 'Đăng nhập thất bại';
      
      if (lastError) {
        switch (lastError) {
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
            errorMessage = lastError;
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    // Success flow
    // Fallback to our local database's display_name if Firebase doesn't provide one
    if (successData.displayName) {
      finalDisplayName = successData.displayName;
    }

    if (!finalDisplayName) {
      try {
        const dbUser = await pool.query('SELECT display_name FROM app_users WHERE email = $1 LIMIT 1', [successData.email.toLowerCase()]);
        if (dbUser.rows.length > 0 && dbUser.rows[0].display_name) {
          finalDisplayName = dbUser.rows[0].display_name;
        }
      } catch (dbErr) {
        console.error('Lỗi lấy tên hiển thị từ local db:', dbErr);
      }
    }

    // Return user data and token
    return NextResponse.json({
      idToken: successData.idToken,
      email: successData.email,
      localId: successData.localId,
      displayName: finalDisplayName || successData.email.split('@')[0],
      expiresIn: successData.expiresIn,
      refreshToken: successData.refreshToken,
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

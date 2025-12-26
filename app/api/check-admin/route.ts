import { NextResponse } from 'next/server';

// URL của Google Apps Script Web App để check admin
const ADMIN_CHECK_SCRIPT_URL = process.env.NEXT_PUBLIC_ADMIN_CHECK_URL || '';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required', isAdmin: false },
        { status: 400 }
      );
    }

    if (!ADMIN_CHECK_SCRIPT_URL) {
      console.error('⚠️ ADMIN_CHECK_URL not configured');
      return NextResponse.json(
        { error: 'Admin check service not configured', isAdmin: false },
        { status: 500 }
      );
    }

    // Gọi Google Apps Script để check admin
    const response = await fetch(
      `${ADMIN_CHECK_SCRIPT_URL}?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Không cache để luôn check real-time
      }
    );

    if (!response.ok) {
      throw new Error(`Apps Script returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      email: email,
      isAdmin: data.isAdmin || false,
      message: data.message || 'Check completed',
    });

  } catch (error) {
    console.error('❌ Admin check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check admin status',
        isAdmin: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

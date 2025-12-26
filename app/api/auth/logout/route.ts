import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Clear any server-side session data if needed
    // For now, we're using localStorage on client-side
    
    return NextResponse.json({ 
      success: true,
      message: 'Đăng xuất thành công' 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi khi đăng xuất' },
      { status: 500 }
    );
  }
}

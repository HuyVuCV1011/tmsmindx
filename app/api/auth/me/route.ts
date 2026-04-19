import { resolveAppUserAccessForEmail } from '@/lib/app-user-access';
import { requireBearerSession } from '@/lib/datasource-api-auth';
import { NextRequest, NextResponse } from 'next/server';

/** Trả về thông tin user theo Bearer (không tin email từ query/body). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await resolveAppUserAccessForEmail(auth.sessionEmail);
    return NextResponse.json({
      success: true,
      email: auth.sessionEmail,
      isAdmin: access.isAdmin,
      isAppUser: access.isAppUser,
      role: access.role,
      permissions: access.permissions,
      userRoles: access.userRoles,
    });
  } catch (error: unknown) {
    console.error('auth/me error:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải thông tin phiên' },
      { status: 500 },
    );
  }
}

import { rejectIfEmailNotSelf, requireBearerSession } from '@/lib/datasource-api-auth';
import { resolveAppUserAccessForEmail } from '@/lib/app-user-access';
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const rl = rateLimitOr429(
    `check-admin:${clientIpFromRequest(request)}`,
    120,
    60_000,
  );
  if (rl) return rl;

  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const emailParam = request.nextUrl.searchParams.get('email');
    let lookupEmail = auth.sessionEmail;

    if (emailParam) {
      const target = emailParam.trim().toLowerCase();
      const denied = rejectIfEmailNotSelf(
        auth.sessionEmail,
        auth.privileged,
        target,
      );
      if (denied) return denied;
      lookupEmail = target;
    }

    const access = await resolveAppUserAccessForEmail(lookupEmail);

    if (!access.found) {
      return NextResponse.json({
        success: true,
        email: lookupEmail,
        isAdmin: false,
        isAppUser: false,
        role: 'teacher',
        permissions: [],
        userRoles: [],
        message: 'Email not found',
      });
    }

    return NextResponse.json({
      success: true,
      email: lookupEmail,
      isAdmin: access.isAdmin,
      isAppUser: access.isAppUser,
      role: access.role,
      permissions: access.permissions,
      userRoles: access.userRoles,
      message: 'Checked from app database',
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status', isAdmin: false, isAppUser: false },
      { status: 500 },
    );
  }
}

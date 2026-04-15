import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isMaintenanceModeEnabled } from '@/lib/maintenance';

export function middleware(request: NextRequest) {
  if (!isMaintenanceModeEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    /\.(?:ico|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|mp4|webm|pdf)$/i.test(
      pathname
    )
  ) {
    return NextResponse.next();
  }

  if (pathname === '/bao-tri' || pathname.startsWith('/bao-tri/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        maintenance: true,
        code: 'MAINTENANCE_MODE',
        message:
          'TPS đang tạm đóng để bảo trì và nâng cấp. Vui lòng quay lại sau. Xin cảm ơn quý thầy cô.',
      },
      { status: 503 }
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = '/bao-tri';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

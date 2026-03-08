import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register', '/forgot-password', '/auth', '/auth/accept-invite'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (set by client on login)
  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

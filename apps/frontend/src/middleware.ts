import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register', '/forgot-password', '/auth', '/auth/accept-invite', '/setup'];

// Runtime API URL for server-side proxying (resolved at request time, not build time)
const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proxy /api/* requests to the backend at runtime,
  // except /api/client-config which is a Next.js route handler
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/client-config')) {
    const url = new URL(pathname + request.nextUrl.search, API_URL);
    return NextResponse.rewrite(url);
  }

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
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

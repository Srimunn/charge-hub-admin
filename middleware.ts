import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Resolve backend URL at runtime (prefer backend internal URL, fallback to public or dev port)
  const backendUrl =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:5000';

  const cleanUrl = backendUrl.replace(/\/$/, '');

  // Specific backend authentication paths that are handled by Express
  const backendAuthPaths = [
    'login',
    'register',
    'verify-otp',
    'google',
    'set-pin',
    'me',
    'request-password-otp',
    'verify-password-otp',
    'change-password',
    'session-timeout',
  ];

  // 1. Check if the path matches a backend-specific auth endpoint (e.g., /api/auth/login)
  const isBackendAuth =
    pathname.startsWith('/api/auth/') &&
    backendAuthPaths.includes(pathname.substring('/api/auth/'.length));

  // 2. Check if the path matches other backend resource route categories
  const backendResources = [
    'users',
    'stations',
    'sessions',
    'faults',
    'payments',
    'dashboard',
    'notifications',
  ];

  const isBackendResource = backendResources.some(resource =>
    pathname === `/api/${resource}` || pathname.startsWith(`/api/${resource}/`)
  );

  // Proxy the request to the Express backend if it matches the routing criteria
  if (isBackendAuth || isBackendResource) {
    const targetUrl = `${cleanUrl}${pathname}${search}`;
    return NextResponse.rewrite(new URL(targetUrl, request.url));
  }

  return NextResponse.next();
}

// Intercept all API endpoints to check if they should be proxied
export const config = {
  matcher: ['/api/:path*'],
};

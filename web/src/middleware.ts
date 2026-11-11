import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, createNonce } from '@/lib/csp';
import {
  PATHNAME_HEADER,
  SESSION_COOKIE,
  isGuestOnlyPath,
  isProtectedPath,
  isTokenExpired,
} from '@/lib/routeAccess';

const CSP_HEADER = 'Content-Security-Policy';

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search, searchParams } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = Boolean(token) && !isTokenExpired(token as string);
  const csp = buildCsp(createNonce(), process.env.NODE_ENV !== 'production');

  const redirect = (url: URL): NextResponse => {
    const response = NextResponse.redirect(url);
    response.headers.set(CSP_HEADER, csp);
    return response;
  };

  if (isProtectedPath(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith('/admin') ? '/admin/login' : '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirect(url);
  }

  if (isGuestOnlyPath(pathname) && hasSession && searchParams.get('session') !== 'expired') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return redirect(url);
  }

  // The framework reads the nonce from the request's policy and stamps it on its own scripts.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathname + search);
  headers.set(CSP_HEADER, csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api/|uploads/|_next/static|_next/image|icon.svg|robots.txt|sitemap.xml).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};

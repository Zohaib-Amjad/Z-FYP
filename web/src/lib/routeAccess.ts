import type { Role } from '@/types';

export const SESSION_COOKIE = 'td_session';

/** Request header the middleware sets so server layouts know which path is being rendered. */
export const PATHNAME_HEADER = 'x-pathname';

/** Prefixes that need a signed-in user. Middleware checks the cookie; layouts check the role. */
const PROTECTED_PREFIXES = [
  '/account',
  '/my-bookings',
  '/notifications',
  '/book',
  '/admin',
] as const;

/** Pages a signed-in user has no reason to see. */
const GUEST_ONLY_PATHS = ['/login', '/register'] as const;

/** Paths that stay reachable without a session even though they live under a protected prefix. */
const PUBLIC_EXCEPTIONS = ['/admin/login'] as const;

/** Prefixes reserved for customers (booking is a customer action). */
const CUSTOMER_PREFIXES = ['/account', '/my-bookings', '/book'] as const;

function matchesPrefix(path: string, prefix: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.some(path => matchesPrefix(pathname, path))) return false;
  return PROTECTED_PREFIXES.some(prefix => matchesPrefix(pathname, prefix));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.some(path => matchesPrefix(pathname, path));
}

/** Role rule: STAFF only under /admin; customer-only pages are closed to staff. */
export function canAccess(pathname: string, role: Role): boolean {
  if (matchesPrefix(pathname, '/admin') && !matchesPrefix(pathname, '/admin/login')) {
    return role === 'STAFF';
  }
  if (CUSTOMER_PREFIXES.some(prefix => matchesPrefix(pathname, prefix))) {
    return role === 'CUSTOMER';
  }
  return true;
}

export function homeFor(role: Role): string {
  return role === 'STAFF' ? '/admin' : '/';
}

/** Only same-site relative paths are accepted as a post-login destination. */
export function safeRedirectTarget(target: string | null | undefined, fallback = '/'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return fallback;
  }
  return target;
}

/** Reads the expiry claim without verifying the signature; the API remains the authority. */
export function isTokenExpired(token: string, nowMs: number = Date.now()): boolean {
  const payload = token.split('.')[1];
  if (!payload) return true;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { exp?: number };
    return typeof claims.exp === 'number' && claims.exp * 1000 <= nowMs;
  } catch {
    return true;
  }
}

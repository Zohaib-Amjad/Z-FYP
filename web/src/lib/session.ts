import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PATHNAME_HEADER, SESSION_COOKIE, canAccess } from '@/lib/routeAccess';
import type { Role, User } from '@/types';

const API_ORIGIN = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Server-side session lookup for layouts and server components.
 * Forwards the visitor's cookie to the API; returns null when signed out.
 */
export async function getSession(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_ORIGIN}/api/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE}=${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data: User };
    return body.data;
  } catch {
    return null;
  }
}

export type SessionCheck = { status: 'ok'; user: User } | { status: 'forbidden'; user: User };

/**
 * Guards a protected layout: redirects signed-out visitors to the right login page and
 * reports a wrong-role visitor so the layout can render the friendly 403 page.
 */
export async function requireSession(allowedRole?: Role): Promise<SessionCheck> {
  const pathname = headers().get(PATHNAME_HEADER) ?? '/';
  const user = await getSession();
  if (!user) {
    const login = pathname.startsWith('/admin') ? '/admin/login' : '/login';
    redirect(`${login}?next=${encodeURIComponent(pathname)}&session=expired`);
  }
  const roleAllowed = allowedRole ? user.role === allowedRole : canAccess(pathname, user.role);
  return roleAllowed ? { status: 'ok', user } : { status: 'forbidden', user };
}

import { describe, expect, it } from 'vitest';
import {
  canAccess,
  homeFor,
  isGuestOnlyPath,
  isProtectedPath,
  isTokenExpired,
  safeRedirectTarget,
} from '@/lib/routeAccess';

const token = (claims: object): string => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
};

describe('isProtectedPath', () => {
  it.each([
    '/account',
    '/account/security',
    '/my-bookings',
    '/notifications',
    '/book',
    '/admin',
    '/admin/vehicles',
  ])('protects %s', path => expect(isProtectedPath(path)).toBe(true));

  it.each([
    '/',
    '/vehicles',
    '/vehicles/abc',
    '/login',
    '/register',
    '/admin/login',
    '/accounting',
  ])('leaves %s public', path => expect(isProtectedPath(path)).toBe(false));
});

describe('isGuestOnlyPath', () => {
  it('flags login and register only', () => {
    expect(isGuestOnlyPath('/login')).toBe(true);
    expect(isGuestOnlyPath('/register')).toBe(true);
    expect(isGuestOnlyPath('/admin/login')).toBe(false);
    expect(isGuestOnlyPath('/loginx')).toBe(false);
  });
});

describe('canAccess', () => {
  it('allows only staff under /admin', () => {
    expect(canAccess('/admin', 'STAFF')).toBe(true);
    expect(canAccess('/admin/bookings', 'STAFF')).toBe(true);
    expect(canAccess('/admin', 'CUSTOMER')).toBe(false);
    expect(canAccess('/admin/bookings', 'CUSTOMER')).toBe(false);
  });

  it('keeps the staff login page open to everyone', () => {
    expect(canAccess('/admin/login', 'CUSTOMER')).toBe(true);
  });

  it('keeps customer-only pages closed to staff', () => {
    for (const path of ['/account', '/my-bookings', '/book', '/book?slotId=1']) {
      expect(canAccess(path, 'CUSTOMER')).toBe(true);
      expect(canAccess(path, 'STAFF')).toBe(false);
    }
  });

  it('allows both roles on shared pages', () => {
    expect(canAccess('/notifications', 'CUSTOMER')).toBe(true);
    expect(canAccess('/vehicles', 'STAFF')).toBe(true);
  });
});

describe('homeFor', () => {
  it('sends staff to the portal and customers to the showroom', () => {
    expect(homeFor('STAFF')).toBe('/admin');
    expect(homeFor('CUSTOMER')).toBe('/');
  });
});

describe('safeRedirectTarget', () => {
  it('accepts same-site paths', () => {
    expect(safeRedirectTarget('/my-bookings?view=upcoming')).toBe('/my-bookings?view=upcoming');
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('rejects %s', target => expect(safeRedirectTarget(target)).toBe('/'));

  it('uses the supplied fallback', () => {
    expect(safeRedirectTarget('//x', '/admin')).toBe('/admin');
  });
});

describe('isTokenExpired', () => {
  const now = 1_800_000_000_000;

  it('reports a future expiry as valid', () => {
    expect(isTokenExpired(token({ exp: now / 1000 + 60 }), now)).toBe(false);
  });

  it('reports a past expiry as expired', () => {
    expect(isTokenExpired(token({ exp: now / 1000 - 1 }), now)).toBe(true);
  });

  it('treats a token without an expiry claim as valid', () => {
    expect(isTokenExpired(token({ sub: 'x' }), now)).toBe(false);
  });

  it('treats malformed tokens as expired', () => {
    expect(isTokenExpired('garbage', now)).toBe(true);
    expect(isTokenExpired('a.%%%.c', now)).toBe(true);
  });
});

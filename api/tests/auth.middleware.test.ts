import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { env } from '../src/config/env';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authenticate, requireRole } from '../src/middleware/auth';
import { ok } from '../src/utils/response';
import { authCookie } from './helpers/auth';
import { resetDatabase, seedMinimalData } from './helpers/db';
import { buildMiniApp } from './helpers/miniApp';

const MISSING_USER_ID = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';
const cookie = (token: string): string => `${env.COOKIE_NAME}=${token}`;

const app = buildMiniApp(router => {
  router.get('/me', authenticate, (req, res) => {
    ok(res, req.user);
  });
  router.get('/staff-only', authenticate, requireRole('STAFF'), (_req, res) => {
    ok(res, { secret: 'staff' });
  });
  router.get('/either', authenticate, requireRole('STAFF', 'CUSTOMER'), (_req, res) => {
    ok(res, { welcome: true });
  });
  router.get('/role-without-auth', requireRole('STAFF'), (_req, res) => {
    ok(res, {});
  });
});

let data: Awaited<ReturnType<typeof seedMinimalData>>;

beforeEach(async () => {
  await resetDatabase();
  data = await seedMinimalData();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

describe('authenticate', () => {
  it('rejects requests without a cookie', async () => {
    const res = await request(app).get('/t/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/t/me').set('Cookie', cookie('not-a-jwt'));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a token signed with another secret', async () => {
    const forged = jwt.sign({ role: 'STAFF' }, 'another-secret-another-secret-123', {
      subject: data.staff.id,
    });
    const res = await request(app).get('/t/me').set('Cookie', cookie(forged));

    expect(res.status).toBe(401);
  });

  it('rejects an unsigned (alg none) token', async () => {
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: data.staff.id, role: 'STAFF' })).toString(
      'base64url',
    );
    const res = await request(app)
      .get('/t/me')
      .set('Cookie', cookie(`${header}.${payload}.`));

    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ role: 'STAFF' }, env.JWT_SECRET, {
      subject: data.staff.id,
      expiresIn: -10,
    });
    const res = await request(app).get('/t/me').set('Cookie', cookie(expired));

    expect(res.status).toBe(401);
  });

  it('rejects a token with a malformed payload', async () => {
    const bad = jwt.sign({ role: 'ADMIN' }, env.JWT_SECRET, { subject: data.staff.id });
    const res = await request(app).get('/t/me').set('Cookie', cookie(bad));

    expect(res.status).toBe(401);
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const res = await request(app)
      .get('/t/me')
      .set('Cookie', authCookie({ id: MISSING_USER_ID, role: 'STAFF' }));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('accepts a valid token and exposes req.user', async () => {
    const res = await request(app).get('/t/me').set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: data.customer.id, role: 'CUSTOMER' });
  });

  it('blocks a deactivated user immediately, even with a valid token', async () => {
    const sessionCookie = authCookie(data.customer);
    await prisma.user.update({ where: { id: data.customer.id }, data: { isActive: false } });
    const res = await request(app).get('/t/me').set('Cookie', sessionCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('trusts the role stored in the database over the role in the token', async () => {
    const res = await request(app)
      .get('/t/staff-only')
      .set('Cookie', authCookie({ id: data.customer.id, role: 'STAFF' }));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('requireRole', () => {
  it('returns 401 when no user is authenticated', async () => {
    const res = await request(app).get('/t/role-without-auth');

    expect(res.status).toBe(401);
  });

  it('returns 403 for the wrong role', async () => {
    const res = await request(app).get('/t/staff-only').set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows the right role', async () => {
    const res = await request(app).get('/t/staff-only').set('Cookie', authCookie(data.staff));

    expect(res.status).toBe(200);
  });

  it('allows any of several roles', async () => {
    const res = await request(app).get('/t/either').set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(200);
  });
});

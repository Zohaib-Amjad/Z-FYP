import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import { TEST_PASSWORD, resetDatabase, seedMinimalData } from './helpers/db';

const NEW_CUSTOMER = {
  firstName: 'Charlotte',
  lastName: 'Ainsworth',
  email: 'charlotte.ainsworth@example.test',
  password: 'Velvet2026',
  confirmPassword: 'Velvet2026',
  phone: '+44 7700 900777',
  drivingLicenseNumber: 'AINSW901015C99XY',
};

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;

const sessionCookieOf = (res: request.Response): string => {
  const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const found = cookies.find(c => c.startsWith(`${env.COOKIE_NAME}=`));
  if (!found) throw new Error('No session cookie was set');
  return found;
};

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

describe('POST /api/auth/register', () => {
  it('creates a customer, logs them in and returns the safe user', async () => {
    const res = await request(app).post('/api/auth/register').send(NEW_CUSTOMER);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      email: 'charlotte.ainsworth@example.test',
      role: 'CUSTOMER',
      firstName: 'Charlotte',
      lastName: 'Ainsworth',
      phone: '+44 7700 900777',
      drivingLicenseNumber: 'AINSW901015C99XY',
      isActive: true,
    });
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('Velvet2026');

    const cookie = sessionCookieOf(res);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('charlotte.ainsworth@example.test');
  });

  it('hashes the password with bcrypt at cost 12', async () => {
    await request(app).post('/api/auth/register').send(NEW_CUSTOMER);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: NEW_CUSTOMER.email } });

    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('Velvet2026', stored.passwordHash)).toBe(true);
  });

  it('normalises the email to lowercase and trims it', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...NEW_CUSTOMER, email: '  Charlotte.Ainsworth@Example.TEST ' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('charlotte.ainsworth@example.test');
  });

  it('allows the driving licence number to be omitted', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...NEW_CUSTOMER, drivingLicenseNumber: undefined });

    expect(res.status).toBe(201);
    expect(res.body.data.drivingLicenseNumber).toBeNull();
  });

  it('returns 409 EMAIL_TAKEN for a duplicate email, ignoring letter case', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...NEW_CUSTOMER, email: 'Customer@Example.test' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(await prisma.user.count()).toBe(2);
  });

  it.each([
    ['too short', 'Ab1'],
    ['no number', 'OnlyLettersHere'],
    ['no letter', '1234567890'],
  ])('rejects a weak password (%s) with 422', async (_label, password) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...NEW_CUSTOMER, password, confirmPassword: password });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('password');
  });

  it('rejects mismatched password confirmation with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...NEW_CUSTOMER, confirmPassword: 'Different2026' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toContainEqual({
      field: 'confirmPassword',
      message: 'Passwords do not match',
    });
  });

  it('reports every invalid field at once', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nope' });

    expect(res.status).toBe(422);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'email', 'password', 'phone']),
    );
  });

  it('ignores a role escalation attempt in the body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...NEW_CUSTOMER, role: 'STAFF' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('CUSTOMER');
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: NEW_CUSTOMER.email } });
    expect(stored.role).toBe('CUSTOMER');
  });

  it('rejects every other unknown field, such as an attempt to set the account state', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...NEW_CUSTOMER, isActive: false, id: 'x' });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'id',
      'isActive',
    ]);
    expect(await prisma.user.count({ where: { email: NEW_CUSTOMER.email } })).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  const credentials = { email: 'customer@example.test', password: TEST_PASSWORD };

  it('signs in, sets a hardened session cookie and returns the safe user', async () => {
    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'customer@example.test', role: 'CUSTOMER' });
    expect(res.body.data).not.toHaveProperty('passwordHash');

    const cookie = sessionCookieOf(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure');
    expect(cookie).toMatch(/Expires=/);

    const token = cookie.split(';')[0].split('=')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.sub).toBe(data.customer.id);
    expect(decoded.role).toBe('CUSTOMER');
  });

  it('accepts the email in any letter case and signs staff in with their role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'STAFF@Example.test', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('STAFF');
  });

  it('updates lastLoginAt', async () => {
    expect(data.customer.lastLoginAt).toBeNull();
    await request(app).post('/api/auth/login').send(credentials);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.customer.id } });

    expect(stored.lastLoginAt).toBeInstanceOf(Date);
  });

  it('returns 401 INVALID_CREDENTIALS for a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'WrongPassw0rd' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('gives the same response for an unknown email as for a wrong password', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'WrongPassw0rd' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'WrongPassw0rd' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('still compares against a dummy hash when the email does not exist', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'Whatever123' });

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
    compare.mockRestore();
  });

  it('returns 403 ACCOUNT_DISABLED for a deactivated account with the right password', async () => {
    await prisma.user.update({ where: { id: data.customer.id }, data: { isActive: false } });
    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('does not reveal a deactivated account to someone with the wrong password', async () => {
    await prisma.user.update({ where: { id: data.customer.id }, data: { isActive: false } });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'WrongPassw0rd' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an empty or malformed body with 422', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('locks the account after repeated failures for the same email (escalating lockout)', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ ...credentials, password: 'WrongPassw0rd' });

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('still enforces the plain rate limit on registration attempts for one email', async () => {
    const attempt = () =>
      request(app).post('/api/auth/register').send({
        firstName: 'A',
        lastName: 'B',
        email: 'bad',
        password: 'x',
        confirmPassword: 'x',
        phone: '1',
      });

    for (let i = 0; i < 10; i += 1) {
      expect((await attempt()).status).toBe(422);
    }
    const blocked = await request(app).post('/api/auth/register').send({
      firstName: 'A',
      lastName: 'B',
      email: 'bad',
      password: 'x',
      confirmPassword: 'x',
      phone: '1',
    });
    expect(blocked.status).toBe(429);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the current user with a valid cookie', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@example.test', password: TEST_PASSWORD });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookieOf(login).split(';')[0]);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: data.staff.id,
      role: 'STAFF',
      firstName: 'Eleanor',
      lastName: 'Whitfield',
    });
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('returns 403 once the account has been deactivated', async () => {
    const cookie = authCookie(data.customer);
    await prisma.user.update({ where: { id: data.customer.id }, data: { isActive: false } });
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookie = sessionCookieOf(res);
    expect(cookie).toMatch(new RegExp(`^${env.COOKIE_NAME}=;`));
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookie).toContain('HttpOnly');
  });

  it('works even when nobody is signed in', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('staff management', () => {
  const newStaff = {
    firstName: 'Marcus',
    lastName: 'Ashworth',
    email: 'Marcus.Ashworth@example.test',
    password: 'Temporary2026',
    phone: '+44 20 7946 0102',
  };

  it('forbids customers from creating staff (403)', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Cookie', authCookie(data.customer))
      .send(newStaff);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.user.count({ where: { role: 'STAFF' } })).toBe(1);
  });

  it('forbids customers from listing staff (403)', async () => {
    const res = await request(app).get('/api/staff').set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(403);
  });

  it('requires authentication (401)', async () => {
    expect((await request(app).post('/api/staff').send(newStaff)).status).toBe(401);
    expect((await request(app).get('/api/staff')).status).toBe(401);
  });

  it('lets staff create another staff account who can then sign in', async () => {
    const created = await request(app)
      .post('/api/staff')
      .set('Cookie', authCookie(data.staff))
      .send(newStaff);

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      email: 'marcus.ashworth@example.test',
      role: 'STAFF',
    });
    expect(created.body.data).not.toHaveProperty('passwordHash');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'marcus.ashworth@example.test', password: 'Temporary2026' });
    expect(login.status).toBe(200);
    expect(login.body.data.role).toBe('STAFF');
  });

  it('rejects a duplicate staff email with 409 EMAIL_TAKEN', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Cookie', authCookie(data.staff))
      .send({ ...newStaff, email: 'customer@example.test' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates the staff payload with 422', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Cookie', authCookie(data.staff))
      .send({ ...newStaff, password: 'weak' });

    expect(res.status).toBe(422);
  });

  it('lists staff accounts only, paginated, without password hashes', async () => {
    const res = await request(app)
      .get('/api/staff?pageSize=10')
      .set('Cookie', authCookie(data.staff));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ email: 'staff@example.test', role: 'STAFF' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

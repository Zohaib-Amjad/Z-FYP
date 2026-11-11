import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import { TEST_PASSWORD, createCustomer, resetDatabase, seedMinimalData } from './helpers/db';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let other: Awaited<ReturnType<typeof createCustomer>>;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  other = await createCustomer(
    'isabella.rossi@example.test',
    'Isabella',
    'Rossi',
    '+44 7700 900555',
  );
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

describe('GET /api/profile', () => {
  it('returns the signed-in user own profile without the password hash', async () => {
    const res = await request(app).get('/api/profile').set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: data.customer.id,
      email: 'customer@example.test',
      firstName: 'Amelia',
      lastName: 'Hart',
    });
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without a session', async () => {
    expect((await request(app).get('/api/profile')).status).toBe(401);
  });

  it('lets staff read their own profile through the same endpoint', async () => {
    const res = await request(app).get('/api/profile').set('Cookie', authCookie(data.staff));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: data.staff.id, role: 'STAFF' });
  });

  it('has no route for reading somebody else by id', async () => {
    const res = await request(app)
      .get(`/api/profile/${other.id}`)
      .set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Isabella');
  });
});

describe('PATCH /api/profile', () => {
  it('updates the permitted fields and trims them', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.customer))
      .send({
        firstName: '  Amélie ',
        lastName: 'Hart-Lowe',
        phone: '+44 7700 900999',
        drivingLicenseNumber: 'HART9503126A99XY',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      firstName: 'Amélie',
      lastName: 'Hart-Lowe',
      phone: '+44 7700 900999',
      drivingLicenseNumber: 'HART9503126A99XY',
    });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.customer.id } });
    expect(stored.firstName).toBe('Amélie');
  });

  it('supports partial updates and leaves other fields untouched', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.customer))
      .send({ phone: '+44 7700 900123' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ firstName: 'Amelia', phone: '+44 7700 900123' });
  });

  it('allows the driving licence number to be removed with null', async () => {
    await prisma.user.update({
      where: { id: data.customer.id },
      data: { drivingLicenseNumber: 'HART9503126A99XY' },
    });
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.customer))
      .send({ drivingLicenseNumber: null });

    expect(res.status).toBe(200);
    expect(res.body.data.drivingLicenseNumber).toBeNull();
  });

  it('rejects empty and whitespace-only strings', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.customer))
      .send({ firstName: '', lastName: '   ', phone: '', drivingLicenseNumber: '' });

    expect(res.status).toBe(422);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'phone', 'drivingLicenseNumber']),
    );
  });

  it('rejects invalid values', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.customer))
      .send({ phone: 'call me', drivingLicenseNumber: '!!' });

    expect(res.status).toBe(422);
  });

  it('rejects unknown fields, including email, role and status flags', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.customer))
      .send({
        firstName: 'Amelia',
        email: 'new@example.test',
        role: 'STAFF',
        isActive: false,
        passwordHash: 'x',
        id: other.id,
      });

    expect(res.status).toBe(422);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['email', 'role', 'isActive', 'passwordHash', 'id']),
    );
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.customer.id } });
    expect(stored.email).toBe('customer@example.test');
    expect(stored.role).toBe('CUSTOMER');
  });

  it('rejects an empty body', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.customer))
      .send({});

    expect(res.status).toBe(422);
  });

  it('returns 401 without a session', async () => {
    expect((await request(app).patch('/api/profile').send({ firstName: 'X' })).status).toBe(401);
  });

  it('only ever changes the signed-in user, never another user', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(other))
      .send({ firstName: 'Changed' });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(other.id);
    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: data.customer.id } });
    expect(untouched.firstName).toBe('Amelia');
  });

  it('lets staff update their own profile', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Cookie', authCookie(data.staff))
      .send({ phone: '+44 20 7946 0999' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: data.staff.id, phone: '+44 20 7946 0999' });
  });
});

describe('PATCH /api/profile/password', () => {
  const change = (cookie: string, body: Record<string, unknown>) =>
    request(app).patch('/api/profile/password').set('Cookie', cookie).send(body);

  it('changes the password; the new one works and the old one no longer does', async () => {
    const res = await change(authCookie(data.customer), {
      currentPassword: TEST_PASSWORD,
      newPassword: 'Brand-new-2026',
      confirmPassword: 'Brand-new-2026',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('Brand-new-2026');

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.customer.id } });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare('Brand-new-2026', stored.passwordHash)).toBe(true);

    const withNew = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.test', password: 'Brand-new-2026' });
    const withOld = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.test', password: TEST_PASSWORD });
    expect(withNew.status).toBe(200);
    expect(withOld.status).toBe(401);
  });

  it('returns 400 INVALID_CURRENT_PASSWORD when the current password is wrong', async () => {
    const res = await change(authCookie(data.customer), {
      currentPassword: 'NotMyPassword1',
      newPassword: 'Brand-new-2026',
      confirmPassword: 'Brand-new-2026',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.customer.id } });
    expect(await bcrypt.compare(TEST_PASSWORD, stored.passwordHash)).toBe(true);
  });

  it.each([
    ['too short', 'Ab1'],
    ['no number', 'OnlyLettersHere'],
    ['no letter', '1234567890'],
  ])('rejects a weak new password (%s) with 422', async (_label, newPassword) => {
    const res = await change(authCookie(data.customer), {
      currentPassword: TEST_PASSWORD,
      newPassword,
      confirmPassword: newPassword,
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('newPassword');
  });

  it('rejects a new password that equals the current one', async () => {
    const res = await change(authCookie(data.customer), {
      currentPassword: TEST_PASSWORD,
      newPassword: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toContainEqual({
      field: 'newPassword',
      message: 'New password must be different from your current password',
    });
  });

  it('rejects a mismatched confirmation', async () => {
    const res = await change(authCookie(data.customer), {
      currentPassword: TEST_PASSWORD,
      newPassword: 'Brand-new-2026',
      confirmPassword: 'Something-else-1',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(
      'confirmPassword',
    );
  });

  it('requires authentication', async () => {
    const res = await request(app).patch('/api/profile/password').send({
      currentPassword: TEST_PASSWORD,
      newPassword: 'Brand-new-2026',
      confirmPassword: 'Brand-new-2026',
    });

    expect(res.status).toBe(401);
  });

  it('only changes the signed-in user own password', async () => {
    await change(authCookie(other), {
      currentPassword: TEST_PASSWORD,
      newPassword: 'Brand-new-2026',
      confirmPassword: 'Brand-new-2026',
    });
    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: data.customer.id } });

    expect(await bcrypt.compare(TEST_PASSWORD, untouched.passwordHash)).toBe(true);
  });

  it('rate limits repeated guesses of the current password', async () => {
    const guess = () =>
      change(authCookie(data.customer), {
        currentPassword: 'NotMyPassword1',
        newPassword: 'Brand-new-2026',
        confirmPassword: 'Brand-new-2026',
      });

    for (let i = 0; i < 10; i += 1) {
      expect((await guess()).status).toBe(400);
    }
    const blocked = await guess();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('profile access to other accounts', () => {
  it('blocks customers from the staff customer endpoints', async () => {
    const cookie = authCookie(data.customer);
    const list = await request(app).get('/api/admin/customers').set('Cookie', cookie);
    const detail = await request(app).get(`/api/admin/customers/${other.id}`).set('Cookie', cookie);
    const status = await request(app)
      .patch(`/api/admin/customers/${other.id}/status`)
      .set('Cookie', cookie)
      .send({ isActive: false });

    expect([list.status, detail.status, status.status]).toEqual([403, 403, 403]);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(stored.isActive).toBe(true);
  });
});

import express from 'express';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { jwtSecretProblem } from '../src/config/jwtSecret';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { auditStaffWrites, requestLogger } from '../src/middleware/requestLog';
import { setAuditSink } from '../src/utils/audit';
import { LoginThrottle } from '../src/utils/loginThrottle';
import { authCookie } from './helpers/auth';
import {
  TEST_PASSWORD,
  createBookingAt,
  createCustomer,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';
import { utcInstant } from './helpers/slots';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
});

afterEach(() => {
  setAuditSink(null);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const target = () => ({ staff: data.staff, vehicle: data.vehicle, dealership: data.dealership });

describe('LoginThrottle', () => {
  const clock = (start = 1_000_000) => {
    let now = start;
    return { now: () => now, advance: (ms: number) => (now += ms) };
  };

  it('does not lock before the threshold and locks from the fifth failure', () => {
    const time = clock();
    const throttle = new LoginThrottle({ now: time.now });
    for (let index = 0; index < 4; index += 1) throttle.recordFailure('a@x.test');
    expect(throttle.remainingLockMs('a@x.test')).toBe(0);

    throttle.recordFailure('a@x.test');
    expect(throttle.remainingLockMs('a@x.test')).toBe(30_000);
  });

  it('doubles the delay with every further failure, up to the maximum', () => {
    const time = clock();
    const throttle = new LoginThrottle({ now: time.now, resetAfterMs: 10 * 60 * 60_000 });
    for (let index = 0; index < 5; index += 1) throttle.recordFailure('a@x.test');
    const delays: number[] = [throttle.remainingLockMs('a@x.test')];
    for (let index = 0; index < 8; index += 1) {
      time.advance(throttle.remainingLockMs('a@x.test') + 1);
      throttle.recordFailure('a@x.test');
      delays.push(throttle.remainingLockMs('a@x.test'));
    }
    expect(delays.slice(0, 4)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(Math.max(...delays)).toBe(15 * 60_000);
  });

  it('releases the lock when time passes and forgets old failures', () => {
    const time = clock();
    const throttle = new LoginThrottle({ now: time.now });
    for (let index = 0; index < 5; index += 1) throttle.recordFailure('a@x.test');
    time.advance(30_001);
    expect(throttle.remainingLockMs('a@x.test')).toBe(0);

    time.advance(16 * 60_000);
    throttle.recordFailure('a@x.test');
    expect(throttle.remainingLockMs('a@x.test')).toBe(0);
  });

  it('clears the count on success and tracks accounts separately', () => {
    const throttle = new LoginThrottle();
    for (let index = 0; index < 5; index += 1) throttle.recordFailure('a@x.test');
    expect(throttle.remainingLockMs('b@x.test')).toBe(0);

    throttle.recordSuccess('a@x.test');
    expect(throttle.remainingLockMs('a@x.test')).toBe(0);
  });

  it('never tracks more than its limit', () => {
    const throttle = new LoginThrottle({ maxTracked: 3 });
    for (const key of ['a', 'b', 'c', 'd'])
      for (let i = 0; i < 5; i += 1) throttle.recordFailure(key);
    expect(throttle.remainingLockMs('a')).toBe(0);
    expect(throttle.remainingLockMs('d')).toBeGreaterThan(0);
  });
});

describe('sign-in lockout over HTTP', () => {
  const login = (email: string, password: string) =>
    request(app).post('/api/auth/login').send({ email, password });

  it('locks an account after five failures, even for the correct password, with Retry-After', async () => {
    for (let index = 0; index < 5; index += 1) {
      expect((await login(data.customer.email, 'wrong-password1')).status).toBe(401);
    }

    const locked = await login(data.customer.email, TEST_PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
    expect(locked.body.error.message).toMatch(/Too many failed sign-in attempts/);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(locked.headers['set-cookie']).toBeUndefined();
  });

  it('treats an unknown address exactly like a real one, so the lock reveals nothing', async () => {
    const unknown = 'nobody@example.test';
    for (let index = 0; index < 5; index += 1) await login(unknown, 'wrong-password1');

    const locked = await login(unknown, 'wrong-password1');
    expect(locked.status).toBe(429);
    expect(locked.body.error.message).toMatch(/Too many failed sign-in attempts/);
  });

  it('does not affect other accounts, and a success resets the count', async () => {
    for (let index = 0; index < 4; index += 1) await login(data.customer.email, 'wrong-password1');
    expect((await login(data.staff.email, TEST_PASSWORD)).status).toBe(200);

    expect((await login(data.customer.email, TEST_PASSWORD)).status).toBe(200);
    for (let index = 0; index < 4; index += 1) await login(data.customer.email, 'wrong-password1');
    expect((await login(data.customer.email, TEST_PASSWORD)).status).toBe(200);
  });

  it('answers wrong password and unknown email with the same status and message', async () => {
    const wrong = await login(data.customer.email, 'wrong-password1');
    const unknown = await login('ghost@example.test', 'wrong-password1');

    expect(wrong.status).toBe(unknown.status);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });
});

describe('CSRF guard', () => {
  const staffCookie = () => authCookie(data.staff);
  const create = () =>
    request(app).post('/api/admin/dealerships').set('Cookie', staffCookie()).send({
      name: 'Origin Test',
      address: '1 Test Street',
      city: 'Testville',
      phone: '+44 20 7946 0000',
      email: 'o@test.example',
      openingHours: 'Mon-Fri 09:00-17:00',
    });

  it('refuses a state-changing request from another origin, by Origin or by Referer', async () => {
    const byOrigin = await create().set('Origin', 'http://evil.example');
    expect(byOrigin.status).toBe(403);
    expect(byOrigin.body.error.code).toBe('FORBIDDEN');

    const byReferer = await create().set('Referer', 'http://evil.example/page');
    expect(byReferer.status).toBe(403);

    const malformed = await create().set('Origin', 'not a url');
    expect(malformed.status).toBe(403);
    expect(await prisma.dealership.count({ where: { name: 'Origin Test' } })).toBe(0);
  });

  it('accepts the web origin (also when only the Referer is sent) and clients that send neither', async () => {
    expect((await create().set('Origin', env.WEB_ORIGIN)).status).toBe(201);
    const second = await request(app)
      .post('/api/admin/dealerships')
      .set('Cookie', staffCookie())
      .set('Referer', `${env.WEB_ORIGIN}/admin/dealerships/new`)
      .send({
        name: 'Referer Test',
        address: '2 Test Street',
        city: 'Testville',
        phone: '+44 20 7946 0001',
        email: 'r@test.example',
        openingHours: 'Mon-Fri 09:00-17:00',
      });
    expect(second.status).toBe(201);
    expect((await create().set('Origin', env.WEB_ORIGIN)).status).toBe(409);
  });

  it('does not restrict reads from other origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(200);
  });

  it('refuses a request body that is not JSON', async () => {
    const form = await request(app)
      .post('/api/auth/login')
      .type('form')
      .send({ email: data.customer.email, password: TEST_PASSWORD });
    expect(form.status).toBe(415);
    expect(form.body.error.code).toBe('VALIDATION_ERROR');
    expect(form.body.error.message).toMatch(/JSON/);

    const text = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'text/plain')
      .send('email=a');
    expect(text.status).toBe(415);
  });

  it('allows multipart only on the image upload route', async () => {
    const elsewhere = await request(app)
      .post('/api/auth/login')
      .set('Cookie', staffCookie())
      .field('email', 'a@b.test');
    expect(elsewhere.status).toBe(415);

    const upload = await request(app)
      .post(`/api/admin/vehicles/${data.vehicle.id}/images`)
      .set('Cookie', staffCookie())
      .attach('images', Buffer.from('not an image'), {
        filename: 'x.png',
        contentType: 'image/png',
      });
    expect(upload.status).not.toBe(415);
    expect(upload.status).toBe(422);
  });

  it('lets a body-less POST such as sign-out through', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(200);
  });
});

describe('JWT secret strength', () => {
  const strong = 'q8Zr!4mLp0Xv#9TgW2bNc7YhD5sKfJ1a';

  it('accepts a strong secret and anything outside production', () => {
    expect(jwtSecretProblem(strong, 'production')).toBeNull();
    expect(jwtSecretProblem('short-dev-secret-ok', 'development')).toBeNull();
  });

  it.each([
    ['too short', 'abc123XYZ!abc123XYZ!', /at least 32/],
    [
      'the published placeholder',
      'super_secret_jwt_key_for_development_purposes_only_min_32_chars',
      /placeholder/,
    ],
    [
      'a placeholder inside a longer value',
      'prefix-changeme-1234567890-abcdefghijklmnop',
      /placeholder/,
    ],
    [
      'the .env.example placeholder',
      'replace_me_with_a_long_random_value_before_production_use',
      /placeholder/,
    ],
    ['low variety', 'ababababababababababababababababab', /variety/],
  ])('refuses %s in production', (_label, secret, message) => {
    expect(jwtSecretProblem(secret, 'production')).toMatch(message);
  });
});

describe('object-level access (IDOR)', () => {
  it("a customer cannot read, cancel or touch another customer's booking", async () => {
    const other = await createCustomer(
      'other.customer@example.test',
      'Olivia',
      'Other',
      '+44 7700 900777',
    );
    const booking = await createBookingAt({
      customerId: other.id,
      target: target(),
      status: 'PENDING',
      slotStart: utcInstant(6, 10),
    });
    const intruder = authCookie(data.customer);

    const read = await request(app).get(`/api/bookings/${booking.id}`).set('Cookie', intruder);
    const cancel = await request(app)
      .patch(`/api/bookings/${booking.id}/cancel`)
      .set('Cookie', intruder)
      .send({});
    expect([read.status, cancel.status]).toEqual([404, 404]);
    expect(read.body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(read.body)).not.toContain('Olivia');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      'PENDING',
    );

    const list = await request(app).get('/api/bookings/mine').set('Cookie', intruder);
    expect(list.body.data.items.map((item: { id: string }) => item.id)).not.toContain(booking.id);
  });

  it("a customer cannot read or mark another customer's notifications", async () => {
    const other = await createCustomer(
      'other.notes@example.test',
      'Nina',
      'Notes',
      '+44 7700 900778',
    );
    const note = await prisma.notification.create({
      data: {
        userId: other.id,
        type: 'BOOKING_APPROVED',
        title: 'Private',
        message: 'Private to Nina.',
      },
    });
    const intruder = authCookie(data.customer);

    const mark = await request(app)
      .patch(`/api/notifications/${note.id}/read`)
      .set('Cookie', intruder);
    expect(mark.status).toBe(404);
    const list = await request(app).get('/api/notifications').set('Cookie', intruder);
    expect(JSON.stringify(list.body)).not.toContain('Private to Nina');
    const all = await request(app).patch('/api/notifications/read-all').set('Cookie', intruder);
    expect(all.status).toBe(200);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: note.id } })).isRead).toBe(
      false,
    );
  });

  it("profile endpoints only ever touch the caller's own record, and ignore an id in the body", async () => {
    const other = await createCustomer(
      'other.profile@example.test',
      'Pia',
      'Profile',
      '+44 7700 900779',
    );
    const cookie = authCookie(data.customer);

    const me = await request(app).get('/api/profile').set('Cookie', cookie);
    expect(me.body.data.id).toBe(data.customer.id);

    const attempt = await request(app)
      .patch('/api/profile')
      .set('Cookie', cookie)
      .send({ id: other.id, firstName: 'Hijacked' });
    expect(attempt.status).toBe(422);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).firstName).toBe(
      'Pia',
    );
  });

  it('staff-only data stays closed to customers even with a valid booking id', async () => {
    const booking = await createBookingAt({
      customerId: data.customer.id,
      target: target(),
      status: 'PENDING',
      slotStart: utcInstant(6, 11),
    });
    const cookie = authCookie(data.customer);

    for (const [method, path] of [
      ['get', `/api/admin/bookings/${booking.id}`],
      ['patch', `/api/admin/bookings/${booking.id}/approve`],
      ['get', `/api/admin/customers/${data.customer.id}`],
      ['get', '/api/staff'],
    ] as const) {
      const res = await request(app)[method](path).set('Cookie', cookie).send({});
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it('blocks a signed-in user on the very next request once their account is deactivated', async () => {
    const cookie = authCookie(data.customer);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);

    await prisma.user.update({ where: { id: data.customer.id }, data: { isActive: false } });

    const blocked = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rejects a tampered or unsigned session token', async () => {
    const valid = authCookie(data.customer);
    const [name, token] = valid.split('=');
    const [header, payload] = token.split('.');
    const forged = `${name}=${header}.${payload}.invalidsignature`;
    const none = `${name}=${Buffer.from('{"alg":"none"}').toString('base64url')}.${payload}.`;

    expect((await request(app).get('/api/auth/me').set('Cookie', forged)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', none)).status).toBe(401);
  });
});

describe('structured logging and audit lines', () => {
  it('writes one JSON line per request without the query string, headers or body', async () => {
    const lines: string[] = [];
    const mini = express();
    mini.use(requestLogger({ write: line => lines.push(line) }));
    mini.get('/things/:id', (_req, res) => res.json({ ok: true }));

    await request(mini)
      .get('/things/42?token=super-secret-token&password=hunter2')
      .set('Cookie', 'td_session=secret-session')
      .set('Authorization', 'Bearer abc');

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: 'info',
      type: 'request',
      method: 'GET',
      path: '/things/42',
      status: 200,
    });
    expect(typeof entry.durationMs).toBe('number');
    expect(lines[0]).not.toMatch(/super-secret-token|hunter2|secret-session|Bearer/);
  });

  it('records who approved which booking, without any request data', async () => {
    const lines: string[] = [];
    setAuditSink(line => lines.push(line));
    const booking = await createBookingAt({
      customerId: data.customer.id,
      target: target(),
      status: 'PENDING',
      slotStart: utcInstant(6, 12),
    });

    const res = await request(app)
      .patch(`/api/admin/bookings/${booking.id}/approve`)
      .set('Cookie', authCookie(data.staff))
      .send({ staffNote: 'Private staff note' });
    expect(res.status).toBe(200);

    const entries = lines.map(line => JSON.parse(line));
    const transition = entries.find(entry => entry.event === 'booking.transition');
    expect(transition).toMatchObject({
      level: 'audit',
      bookingId: booking.id,
      from: 'PENDING',
      to: 'APPROVED',
      actor: 'STAFF',
      actorId: data.staff.id,
    });
    const write = entries.find(entry => entry.event === 'staff.write');
    expect(write).toMatchObject({
      actorId: data.staff.id,
      method: 'PATCH',
      route: '/api/admin/bookings/:id/approve',
      params: { id: booking.id },
      status: 200,
    });
    expect(lines.join('')).not.toContain('Private staff note');
  });

  it('never puts a new staff account password into the audit log', async () => {
    const lines: string[] = [];
    setAuditSink(line => lines.push(line));

    const res = await request(app).post('/api/staff').set('Cookie', authCookie(data.staff)).send({
      firstName: 'New',
      lastName: 'Colleague',
      email: 'new.colleague@example.test',
      phone: '+44 20 7946 0100',
      password: 'Welcome-2026-secret',
    });

    expect(res.status).toBe(201);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('')).not.toContain('Welcome-2026-secret');
  });

  it('does not log failed or read-only staff calls', async () => {
    const lines: string[] = [];
    setAuditSink(line => lines.push(line));
    const staff = authCookie(data.staff);

    await request(app).get('/api/admin/bookings').set('Cookie', staff);
    await request(app)
      .patch('/api/admin/bookings/00000000-0000-4000-8000-000000000000/approve')
      .set('Cookie', staff)
      .send({});

    expect(lines).toEqual([]);
  });
});

describe('auditStaffWrites middleware', () => {
  it('ignores unauthenticated requests', async () => {
    const lines: string[] = [];
    setAuditSink(line => lines.push(line));
    const mini = express();
    mini.use(auditStaffWrites);
    mini.post('/x', (_req, res) => res.status(201).json({}));

    await request(mini).post('/x');

    expect(lines).toEqual([]);
  });
});

describe('email address validation (mail-library advisory)', () => {
  const register = (email: string) =>
    request(app).post('/api/auth/register').send({
      firstName: 'Mail',
      lastName: 'Check',
      email,
      phone: '+44 7700 900500',
      password: 'Prestige2026',
      confirmPassword: 'Prestige2026',
    });

  it.each([
    '"attacker@evil.example"@legit.example',
    'user@legit.example,other@evil.example',
    'user@legit.example;other@evil.example',
    'user%evil.example@legit.example',
    'a@b@c.example',
    'user@legit.example>',
    'user name@legit.example',
  ])('refuses %s', async email => {
    const res = await register(email);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('still accepts ordinary addresses, including plus tags and subdomains', async () => {
    const res = await register('first.last+tag@mail.legit-example.co.uk');
    expect(res.status).toBe(201);
  });
});

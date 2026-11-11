import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import {
  createBookingAt,
  createCustomer,
  createDealership,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';
import { AppRoute, Audience, audienceOf, listRoutes, routeLabel } from './helpers/routes';
import { addSlot, utcInstant } from './helpers/slots';

let app = createApp();
const routes = listRoutes(app);
const label = routeLabel;

const ALLOWED_STATUSES = new Set([200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 503]);
const FORBIDDEN_KEY =
  /^(passwordHash|password|confirmPassword|currentPassword|newPassword|token|jwt|secret)$/i;
const BCRYPT_HASH = /\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/;
const PLACEHOLDER_ID = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';

let data: Awaited<ReturnType<typeof seedMinimalData>>;
let other: Awaited<ReturnType<typeof createCustomer>>;
let bookingId: string;
let notificationId: string;
let staffCookie: string;
let customerCookie: string;

const resolvePath = (route: AppRoute, value?: string): string =>
  route.path.replace(/:(\w+)/g, (_match, param: string) => {
    if (value) return value;
    if (param === 'imageId') return PLACEHOLDER_ID;
    if (route.path === '/api/bookings/slots/:id') return data.slot.id;
    if (route.path.startsWith('/api/admin/bookings') || route.path.startsWith('/api/bookings'))
      return bookingId;
    if (route.path.startsWith('/api/admin/customers')) return data.customer.id;
    if (route.path.startsWith('/api/notifications')) return notificationId;
    if (route.path.includes('dealerships/') || route.path.startsWith('/api/dealerships')) {
      return route.path.includes('/vehicles/') ? data.vehicle.id : data.dealership.id;
    }
    if (route.path.startsWith('/api/admin/slots')) return data.slot.id;
    return data.vehicle.id;
  });

const send = (route: AppRoute, url: string, cookie?: string, body?: object) => {
  const req = request(app)[route.method](url);
  if (cookie) req.set('Cookie', cookie);
  return body === undefined ? req : req.send(body);
};

const cookieFor = (audience: Audience): string | undefined =>
  audience === 'public' ? undefined : audience === 'customer' ? customerCookie : staffCookie;

const isWrite = (route: AppRoute): boolean => ['post', 'put', 'patch'].includes(route.method);

beforeEach(() => {
  app = createApp();
});

beforeAll(async () => {
  await resetDatabase();
  data = await seedMinimalData();
  other = await createCustomer(
    'isabella.rossi@example.test',
    'Isabella',
    'Rossi',
    '+44 7700 900555',
  );
  staffCookie = authCookie(data.staff);
  customerCookie = authCookie(data.customer);
  const booking = await createBookingAt({
    customerId: data.customer.id,
    target: { staff: data.staff, vehicle: data.vehicle, dealership: data.dealership },
    status: 'APPROVED',
    slotStart: utcInstant(5, 10),
  });
  bookingId = booking.id;
  const notification = await prisma.notification.create({
    data: {
      userId: data.customer.id,
      bookingId,
      type: 'BOOKING_APPROVED',
      title: 'Test drive confirmed',
      message: 'Your test drive has been confirmed.',
    },
  });
  notificationId = notification.id;
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

describe('route inventory', () => {
  it('finds the whole API and classifies every route', () => {
    expect(routes.length).toBeGreaterThanOrEqual(62);
    for (const route of routes) expect(() => audienceOf(route)).not.toThrow();
    expect(new Set(routes.map(label)).size).toBe(routes.length);
    expect(routes.every(route => route.path.startsWith('/api/'))).toBe(true);
  });
});

describe('authentication and roles', () => {
  const protectedRoutes = routes.filter(route => audienceOf(route) !== 'public');

  it.each(protectedRoutes.map(label))('%s refuses anonymous callers with 401', async name => {
    const route = protectedRoutes.find(r => label(r) === name)!;
    const res = await send(route, resolvePath(route), undefined, isWrite(route) ? {} : undefined);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  const staffRoutes = routes.filter(route => audienceOf(route) === 'staff');
  it.each(staffRoutes.map(label))('%s refuses customers with 403', async name => {
    const route = staffRoutes.find(r => label(r) === name)!;
    const res = await send(
      route,
      resolvePath(route),
      customerCookie,
      isWrite(route) ? {} : undefined,
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  const customerRoutes = routes.filter(route => audienceOf(route) === 'customer');
  it.each(customerRoutes.map(label))('%s refuses staff with 403', async name => {
    const route = customerRoutes.find(r => label(r) === name)!;
    const res = await send(route, resolvePath(route), staffCookie, isWrite(route) ? {} : undefined);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('input validation on every route', () => {
  const withParams = routes.filter(route => route.path.includes(':'));
  it.each(withParams.map(label))('%s rejects a malformed id with 422', async name => {
    const route = withParams.find(r => label(r) === name)!;
    const res = await send(
      route,
      resolvePath(route, 'not-a-uuid'),
      cookieFor(audienceOf(route)),
      isWrite(route) ? {} : undefined,
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  const querying = routes.filter(route => label(route) !== 'GET /api/health');
  it.each(querying.map(label))('%s rejects an unknown query parameter with 422', async name => {
    const route = querying.find(r => label(r) === name)!;
    const res = await send(
      route,
      `${resolvePath(route)}?zzUnknown=1`,
      cookieFor(audienceOf(route)),
      isWrite(route) ? {} : undefined,
    );

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('zzUnknown');
  });

  const writing = routes.filter(isWrite);
  it.each(writing.map(label))('%s rejects an unknown body field with 422', async name => {
    const route = writing.find(r => label(r) === name)!;
    const res = await send(route, resolvePath(route), cookieFor(audienceOf(route)), {
      zzUnknown: 1,
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('zzUnknown');
  });

  it('request schemas trim free text; only password fields are left untouched', () => {
    const dir = path.resolve(__dirname, '..', 'src', 'validators');
    const untrimmed: string[] = [];
    for (const file of fs.readdirSync(dir)) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const match of source.matchAll(/z\s*\.string\(/g)) {
        const chain = source.slice(match.index, match.index + 260).split(/\n\s*\n|;\n/)[0];
        const line = source.slice(0, match.index).split('\n').length;
        const preceding = source.slice(Math.max(0, match.index - 40), match.index);
        const safe =
          /\.trim\(\)|\.uuid\(|\.datetime\(|\.regex\(|\.refine\(/.test(chain.slice(0, 200)) ||
          /assword/.test(preceding);
        if (!safe) untrimmed.push(`${file}:${line}`);
      }
    }

    expect(untrimmed).toEqual([]);
  });
});

describe('responses', () => {
  const readable = routes.filter(route => route.method === 'get');
  const ARRAY_ROUTES = new Set(['GET /api/dealerships', 'GET /api/admin/vehicles/:id/dealerships']);

  const collectKeys = (value: unknown, found: string[] = []): string[] => {
    if (Array.isArray(value)) value.forEach(item => collectKeys(item, found));
    else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        found.push(key);
        collectKeys(inner, found);
      }
    }
    return found;
  };

  it.each(readable.map(label))(
    '%s returns the success envelope and never leaks credentials',
    async name => {
      const route = readable.find(r => label(r) === name)!;
      const res = await send(route, resolvePath(route), cookieFor(audienceOf(route)));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
      expect(collectKeys(res.body).filter(key => FORBIDDEN_KEY.test(key))).toEqual([]);
      expect(JSON.stringify(res.body)).not.toMatch(BCRYPT_HASH);
      if (Array.isArray(res.body.data))
        expect(ARRAY_ROUTES.has(name), `${name} returns an unbounded array`).toBe(true);
    },
  );

  it('write endpoints that return users never include credentials', async () => {
    const responses = await Promise.all([
      request(app)
        .post('/api/auth/login')
        .send({ email: 'customer@example.test', password: 'Passw0rd-test' }),
      request(app).post('/api/auth/register').send({
        firstName: 'Audit',
        lastName: 'Visitor',
        email: 'audit.visitor@example.test',
        password: 'Velvet2026',
        confirmPassword: 'Velvet2026',
        phone: '+44 7700 900777',
      }),
      request(app).post('/api/staff').set('Cookie', staffCookie).send({
        firstName: 'Audit',
        lastName: 'Staff',
        email: 'audit.staff@example.test',
        password: 'Velvet2026',
        phone: '+44 20 7946 0199',
      }),
      request(app)
        .patch('/api/profile')
        .set('Cookie', customerCookie)
        .send({ phone: '+44 7700 900123' }),
      request(app)
        .patch(`/api/admin/customers/${other.id}/status`)
        .set('Cookie', staffCookie)
        .send({ isActive: true }),
    ]);

    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
      expect(collectKeys(res.body).filter(key => FORBIDDEN_KEY.test(key))).toEqual([]);
      expect(JSON.stringify(res.body)).not.toMatch(BCRYPT_HASH);
    }
  });

  it('every error response, whatever the cause, uses the failure envelope and a documented status', async () => {
    const probes = await Promise.all([
      request(app).get('/api/nothing-here'),
      request(app).get('/api/admin/bookings'),
      request(app).get('/api/admin/bookings').set('Cookie', customerCookie),
      request(app).get('/api/vehicles?sort=nope'),
      request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{broken'),
      request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.test', password: 'Whatever123' }),
      request(app).get(`/api/bookings/${PLACEHOLDER_ID}`).set('Cookie', customerCookie),
      request(app)
        .patch(`/api/admin/bookings/${bookingId}/complete`)
        .set('Cookie', staffCookie)
        .send({}),
    ]);

    expect(probes.map(r => r.status)).toEqual([404, 401, 403, 422, 400, 401, 404, 409]);
    for (const res of probes) {
      expect(ALLOWED_STATUSES.has(res.status)).toBe(true);
      expect(res.body.success).toBe(false);
      expect(typeof res.body.error.code).toBe('string');
      expect(typeof res.body.error.message).toBe('string');
      expect(JSON.stringify(res.body)).not.toMatch(/stack|prisma|SELECT |at \S+ \(/i);
    }
  });
});

describe('ownership', () => {
  it('another customer gets 404 for the booking and notification of someone else', async () => {
    const stranger = authCookie(other);
    const responses = await Promise.all([
      request(app).get(`/api/bookings/${bookingId}`).set('Cookie', stranger),
      request(app).patch(`/api/bookings/${bookingId}/cancel`).set('Cookie', stranger).send({}),
      request(app).patch(`/api/notifications/${notificationId}/read`).set('Cookie', stranger),
    ]);

    expect(responses.map(r => r.status)).toEqual([404, 404, 404]);
    expect(new Set(responses.map(r => r.body.error.code))).toEqual(new Set(['NOT_FOUND']));
    const mine = await request(app).get('/api/bookings/mine').set('Cookie', stranger);
    expect(mine.body.data.total).toBe(0);
    const inbox = await request(app).get('/api/notifications').set('Cookie', stranger);
    expect(inbox.body.data.total).toBe(0);
  });
});

describe('pagination limits', () => {
  const PAGINATED = [
    'GET /api/vehicles',
    'GET /api/admin/vehicles',
    'GET /api/admin/dealerships',
    'GET /api/admin/slots',
    'GET /api/admin/customers',
    'GET /api/admin/bookings',
    'GET /api/staff',
    'GET /api/bookings/mine',
    'GET /api/notifications',
  ];
  const listRoutesToProbe = routes.filter(route => PAGINATED.includes(label(route)));

  it('covers every paginated list', () => {
    expect(listRoutesToProbe).toHaveLength(PAGINATED.length);
  });

  it.each(PAGINATED)('%s caps the page size at 50 and refuses nonsense', async name => {
    const route = listRoutesToProbe.find(r => label(r) === name)!;
    const cookie = cookieFor(audienceOf(route));
    const probe = (query: string) => send(route, `${route.path}?${query}`, cookie);

    expect((await probe('pageSize=51')).status).toBe(422);
    expect((await probe('pageSize=0')).status).toBe(422);
    expect((await probe('pageSize=-1')).status).toBe(422);
    expect((await probe('page=0')).status).toBe(422);
    expect((await probe('page=abc')).status).toBe(422);
    const max = await probe('pageSize=50');
    expect(max.status).toBe(200);
    expect(max.body.data.pageSize).toBe(50);
    const fallback = await probe('');
    expect(fallback.body.data.pageSize).toBeLessThanOrEqual(50);
  });

  it('keeps the two unpaginated lists bounded', async () => {
    for (let index = 0; index < 3; index += 1)
      await createDealership(`Audit Dealership ${index}`, `City ${index}`);
    const res = await request(app).get('/api/dealerships');

    expect(res.body.data.length).toBeLessThanOrEqual(100);
  });
});

describe('query cost: no N+1', () => {
  const ENDPOINTS: [string, () => string, string?][] = [
    ['admin bookings', () => '/api/admin/bookings?pageSize=50', 'staff'],
    ['admin customers', () => '/api/admin/customers?pageSize=50', 'staff'],
    ['admin vehicles', () => '/api/admin/vehicles?pageSize=50', 'staff'],
    ['admin dealerships', () => '/api/admin/dealerships?pageSize=50', 'staff'],
    ['admin slots', () => '/api/admin/slots?pageSize=50', 'staff'],
    ['staff accounts', () => '/api/staff?pageSize=50', 'staff'],
    ['catalog', () => '/api/vehicles?pageSize=50'],
    ['public dealerships', () => '/api/dealerships'],
    ['my bookings', () => '/api/bookings/mine?pageSize=50', 'customer'],
    ['notifications', () => '/api/notifications?pageSize=50', 'customer'],
    ['dashboard summary', () => '/api/admin/dashboard/summary', 'staff'],
    ['top vehicles', () => '/api/admin/dashboard/top-vehicles?days=365&limit=20', 'staff'],
  ];

  let operations = 0;
  prisma.$use(async (params, next) => {
    operations += 1;
    return next(params);
  });

  const measure = async (url: string, role?: string): Promise<number> => {
    operations = 0;
    const cookie =
      role === 'staff' ? staffCookie : role === 'customer' ? customerCookie : undefined;
    const req = request(app).get(url);
    if (cookie) req.set('Cookie', cookie);
    const res = await req;
    expect(res.status).toBe(200);
    return operations;
  };

  it('uses the same number of database operations however many rows come back', async () => {
    const small = new Map<string, number>();
    for (const [name, url, role] of ENDPOINTS) small.set(name, await measure(url(), role));

    const mayfair = data.dealership;
    for (let index = 0; index < 15; index += 1) {
      const vehicle = await createVehicle({
        manufacturer: `Marque${index}`,
        model: `Model ${index}`,
      });
      await linkVehicle(mayfair.id, vehicle.id);
      const dealership = await createDealership(`Scale Dealership ${index}`, `Scale City ${index}`);
      await linkVehicle(dealership.id, vehicle.id);
      const customer = await createCustomer(
        `scale${index}@example.test`,
        'Scale',
        `Customer${index}`,
        '+44 7700 900900',
      );
      const booking = await createBookingAt({
        customerId: index % 2 === 0 ? data.customer.id : customer.id,
        target: { staff: data.staff, vehicle, dealership: mayfair },
        status: 'APPROVED',
        slotStart: utcInstant(20 + index, 10),
      });
      await addSlot({ staff: data.staff, vehicle, dealership }, utcInstant(40 + index, 10));
      await prisma.notification.create({
        data: {
          userId: data.customer.id,
          bookingId: booking.id,
          type: 'BOOKING_CREATED',
          title: `Scale ${index}`,
          message: 'x',
        },
      });
    }

    for (const [name, url, role] of ENDPOINTS) {
      expect(await measure(url(), role), `${name} scales with the number of rows`).toBe(
        small.get(name),
      );
    }
  });
});

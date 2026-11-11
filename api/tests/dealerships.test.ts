import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import {
  createBooking,
  createDealership,
  createSlot,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;
let customerCookie: string;

const validBody = {
  name: 'Prestige Edinburgh',
  address: '9 Charlotte Square',
  city: 'Edinburgh',
  phone: '+44 131 496 3000',
  email: 'Edinburgh@Prestige.test',
  openingHours: 'Mon-Fri 09:00-17:30, Sat 09:00-13:00',
};

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  staffCookie = authCookie(data.staff);
  customerCookie = authCookie(data.customer);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const staffGet = (url: string) => request(app).get(url).set('Cookie', staffCookie);
const staffPost = (url: string, body: object) =>
  request(app).post(url).set('Cookie', staffCookie).send(body);
const staffPatch = (url: string, body: object = {}) =>
  request(app).patch(url).set('Cookie', staffCookie).send(body);
const fieldsOf = (res: request.Response): string[] =>
  res.body.error.details.map((d: { field: string }) => d.field);

describe('public: GET /api/dealerships', () => {
  it('lists active dealerships without authentication and hides internal fields', async () => {
    await createDealership('Prestige Deansgate', 'Manchester', { isActive: false });
    const res = await request(app).get('/api/dealerships');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: data.dealership.id, name: 'Prestige Mayfair' });
    expect(res.body.data[0]).not.toHaveProperty('isActive');
    expect(res.body.data[0]).not.toHaveProperty('createdAt');
  });

  it('orders by city then name', async () => {
    await createDealership('Prestige Deansgate', 'Manchester');
    await createDealership('Prestige Edinburgh', 'Edinburgh');
    const res = await request(app).get('/api/dealerships');

    expect(res.body.data.map((d: { city: string }) => d.city)).toEqual([
      'Edinburgh',
      'London',
      'Manchester',
    ]);
  });

  it('filters by city, ignoring case', async () => {
    await createDealership('Prestige Deansgate', 'Manchester');
    const res = await request(app).get('/api/dealerships?city=MANCHESTER');

    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(['Prestige Deansgate']);
  });

  it('filters by the vehicle on offer', async () => {
    const elsewhere = await createDealership('Prestige Deansgate', 'Manchester');
    const unavailable = await createDealership('Prestige Edinburgh', 'Edinburgh');
    await linkVehicle(unavailable.id, data.vehicle.id, false);
    const res = await request(app).get(`/api/dealerships?vehicleId=${data.vehicle.id}`);

    expect(res.body.data.map((d: { id: string }) => d.id)).toEqual([data.dealership.id]);
    expect(res.body.data.map((d: { id: string }) => d.id)).not.toContain(elsewhere.id);
  });

  it('leaves out inactive dealerships even when they offer the vehicle', async () => {
    const inactive = await createDealership('Prestige Deansgate', 'Manchester', {
      isActive: false,
    });
    await linkVehicle(inactive.id, data.vehicle.id);
    const res = await request(app).get(`/api/dealerships?vehicleId=${data.vehicle.id}`);

    expect(res.body.data.map((d: { id: string }) => d.id)).toEqual([data.dealership.id]);
  });

  it('returns nothing for a deactivated vehicle', async () => {
    await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: false } });
    const res = await request(app).get(`/api/dealerships?vehicleId=${data.vehicle.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('combines vehicle and city filters', async () => {
    const res = await request(app).get(
      `/api/dealerships?vehicleId=${data.vehicle.id}&city=Manchester`,
    );

    expect(res.body.data).toEqual([]);
  });

  it('returns an empty list for an unknown vehicle and 422 for a malformed id', async () => {
    const unknown = await request(app).get(
      '/api/dealerships?vehicleId=0bbe7e55-75e7-4355-b1e3-af30b7b9ee11',
    );
    const malformed = await request(app).get('/api/dealerships?vehicleId=abc');

    expect(unknown.body.data).toEqual([]);
    expect(malformed.status).toBe(422);
  });
});

describe('public: GET /api/dealerships/:id', () => {
  it('returns an active dealership', async () => {
    const res = await request(app).get(`/api/dealerships/${data.dealership.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Prestige Mayfair', city: 'London' });
  });

  it('returns 404 for an inactive or unknown dealership and 422 for a malformed id', async () => {
    const inactive = await createDealership('Prestige Deansgate', 'Manchester', {
      isActive: false,
    });

    expect((await request(app).get(`/api/dealerships/${inactive.id}`)).status).toBe(404);
    expect(
      (await request(app).get('/api/dealerships/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status,
    ).toBe(404);
    expect((await request(app).get('/api/dealerships/nope')).status).toBe(422);
  });
});

describe('admin: access control', () => {
  const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';
  const send = (method: string, url: string): request.Test =>
    method === 'get'
      ? request(app).get(url)
      : method === 'post'
        ? request(app).post(url)
        : request(app).patch(url);
  const calls: [string, string][] = [
    ['get', '/api/admin/dealerships'],
    ['get', `/api/admin/dealerships/${id}`],
    ['post', '/api/admin/dealerships'],
    ['patch', `/api/admin/dealerships/${id}`],
    ['patch', `/api/admin/dealerships/${id}/deactivate`],
    ['patch', `/api/admin/dealerships/${id}/activate`],
  ];

  it.each(calls)('%s %s requires authentication', async (method, url) => {
    const res = await send(method, url);

    expect(res.status).toBe(401);
  });

  it.each(calls)('%s %s is forbidden to customers', async (method, url) => {
    const res = await send(method, url).set('Cookie', customerCookie);

    expect(res.status).toBe(403);
  });
});

describe('admin: GET /api/admin/dealerships', () => {
  beforeEach(async () => {
    await createDealership('Prestige Deansgate', 'Manchester', { isActive: false });
    await createDealership('Prestige Edinburgh', 'Edinburgh');
  });

  it('includes inactive dealerships and the vehicle count', async () => {
    const res = await staffGet('/api/admin/dealerships');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, pageSize: 10, totalPages: 1 });
    const mayfair = res.body.data.items.find((d: { id: string }) => d.id === data.dealership.id);
    expect(mayfair).toMatchObject({ vehicleCount: 1, isActive: true });
    expect(res.body.data.items.some((d: { isActive: boolean }) => !d.isActive)).toBe(true);
  });

  it('searches by name, city and address, case-insensitively', async () => {
    const byCity = await staffGet('/api/admin/dealerships?q=manchester');
    const byName = await staffGet('/api/admin/dealerships?q=EDINBURGH');
    const byWords = await staffGet('/api/admin/dealerships?q=prestige%20london');

    expect(byCity.body.data.items.map((d: { city: string }) => d.city)).toEqual(['Manchester']);
    expect(byName.body.data.items.map((d: { city: string }) => d.city)).toEqual(['Edinburgh']);
    expect(byWords.body.data.total).toBe(1);
  });

  it('filters by active status', async () => {
    const inactive = await staffGet('/api/admin/dealerships?isActive=false');
    const active = await staffGet('/api/admin/dealerships?isActive=true');

    expect(inactive.body.data.total).toBe(1);
    expect(active.body.data.total).toBe(2);
  });

  it('paginates and sorts', async () => {
    const first = await staffGet('/api/admin/dealerships?pageSize=2&page=1&sortBy=city');
    const second = await staffGet('/api/admin/dealerships?pageSize=2&page=2&sortBy=city');
    const desc = await staffGet('/api/admin/dealerships?sortBy=city&sortOrder=desc');

    expect(first.body.data.items.map((d: { city: string }) => d.city)).toEqual([
      'Edinburgh',
      'London',
    ]);
    expect(second.body.data.items.map((d: { city: string }) => d.city)).toEqual(['Manchester']);
    expect(desc.body.data.items[0].city).toBe('Manchester');
  });

  it('rejects invalid query parameters', async () => {
    expect((await staffGet('/api/admin/dealerships?sortBy=email')).status).toBe(422);
    expect((await staffGet('/api/admin/dealerships?pageSize=500')).status).toBe(422);
  });
});

describe('admin: GET /api/admin/dealerships/:id', () => {
  it('returns an inactive dealership with its upcoming active booking count', async () => {
    await createBooking(data.customer.id, data.slot.id, 'PENDING');
    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { isActive: false },
    });
    const res = await staffGet(`/api/admin/dealerships/${data.dealership.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: data.dealership.id,
      isActive: false,
      vehicleCount: 1,
      upcomingActiveBookingCount: 1,
    });
  });

  it('returns 404 for unknown ids and 422 for malformed ones', async () => {
    expect(
      (await staffGet('/api/admin/dealerships/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status,
    ).toBe(404);
    expect((await staffGet('/api/admin/dealerships/xyz')).status).toBe(422);
  });
});

describe('admin: POST /api/admin/dealerships', () => {
  it('creates an active dealership, trimming and normalising input', async () => {
    const res = await staffPost('/api/admin/dealerships', {
      ...validBody,
      name: '  Prestige Edinburgh ',
      description: ' A refined showroom. ',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Prestige Edinburgh',
      email: 'edinburgh@prestige.test',
      description: 'A refined showroom.',
      isActive: true,
      vehicleCount: 0,
    });
    expect(await prisma.dealership.count()).toBe(2);
  });

  it('treats the description as optional', async () => {
    const res = await staffPost('/api/admin/dealerships', validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBeNull();
  });

  it.each(['name', 'address', 'city', 'phone', 'email', 'openingHours'])(
    'requires %s',
    async field => {
      const res = await staffPost('/api/admin/dealerships', { ...validBody, [field]: undefined });

      expect(res.status).toBe(422);
      expect(fieldsOf(res)).toContain(field);
    },
  );

  it('validates formats and lengths', async () => {
    const res = await staffPost('/api/admin/dealerships', {
      ...validBody,
      name: 'X',
      phone: 'call us',
      email: 'not-an-email',
      city: 'E',
      address: 'x'.repeat(201),
      description: '',
    });

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toEqual(
      expect.arrayContaining(['name', 'phone', 'email', 'city', 'address', 'description']),
    );
  });

  it('rejects unknown fields such as isActive', async () => {
    const res = await staffPost('/api/admin/dealerships', {
      ...validBody,
      isActive: false,
      id: 'x',
    });

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toEqual(expect.arrayContaining(['isActive', 'id']));
  });

  it('rejects a duplicate name in the same city regardless of case', async () => {
    const res = await staffPost('/api/admin/dealerships', {
      ...validBody,
      name: 'PRESTIGE MAYFAIR',
      city: 'london',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(fieldsOf(res)).toContain('name');
    expect(await prisma.dealership.count()).toBe(1);
  });

  it('allows the same name in a different city', async () => {
    const res = await staffPost('/api/admin/dealerships', {
      ...validBody,
      name: 'Prestige Mayfair',
    });

    expect(res.status).toBe(201);
  });

  it('is backed by a database unique index', async () => {
    await expect(createDealership('prestige mayfair', 'LONDON')).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});

describe('admin: PATCH /api/admin/dealerships/:id', () => {
  const url = () => `/api/admin/dealerships/${data.dealership.id}`;

  it('updates any field', async () => {
    const res = await staffPatch(url(), {
      name: 'Prestige Berkeley Square',
      address: '15 Berkeley Square',
      city: 'London',
      phone: '+44 20 7946 1999',
      email: 'berkeley@prestige.test',
      openingHours: 'Mon-Sat 10:00-19:00',
      description: 'Our flagship showroom.',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Prestige Berkeley Square',
      address: '15 Berkeley Square',
      phone: '+44 20 7946 1999',
      email: 'berkeley@prestige.test',
      openingHours: 'Mon-Sat 10:00-19:00',
      description: 'Our flagship showroom.',
    });
  });

  it('supports partial updates and clearing the description with null', async () => {
    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { description: 'Old' },
    });
    const res = await staffPatch(url(), { description: null });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ description: null, name: 'Prestige Mayfair' });
  });

  it('allows re-saving the dealership own name and city', async () => {
    const res = await staffPatch(url(), { name: 'prestige mayfair', city: 'London' });

    expect(res.status).toBe(200);
  });

  it('rejects a rename or move that collides with another dealership', async () => {
    await createDealership('Prestige Deansgate', 'Manchester');
    await createDealership('Prestige Mayfair', 'Manchester');
    const rename = await staffPatch(url(), { name: 'Prestige Deansgate', city: 'Manchester' });
    const move = await staffPatch(url(), { city: 'Manchester' });

    expect(rename.status).toBe(409);
    expect(move.status).toBe(409);
  });

  it('does not allow activation state or id to be changed here', async () => {
    const res = await staffPatch(url(), { isActive: false, id: 'x' });

    expect(res.status).toBe(422);
    const stored = await prisma.dealership.findUniqueOrThrow({ where: { id: data.dealership.id } });
    expect(stored.isActive).toBe(true);
  });

  it('rejects empty bodies, empty strings and bad formats', async () => {
    expect((await staffPatch(url(), {})).status).toBe(422);
    expect((await staffPatch(url(), { name: '' })).status).toBe(422);
    expect((await staffPatch(url(), { phone: 'abc', email: 'nope' })).status).toBe(422);
  });

  it('returns 404 for an unknown dealership', async () => {
    const res = await staffPatch('/api/admin/dealerships/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', {
      name: 'Prestige Windsor',
    });

    expect(res.status).toBe(404);
  });
});

describe('admin: deactivate and activate', () => {
  const deactivate = (id = data.dealership.id) =>
    staffPatch(`/api/admin/dealerships/${id}/deactivate`);
  const activate = (id = data.dealership.id) => staffPatch(`/api/admin/dealerships/${id}/activate`);

  it('deactivates a dealership without upcoming bookings and hides it from customers', async () => {
    const res = await deactivate();

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    const list = await request(app).get('/api/dealerships');
    const detail = await request(app).get(`/api/dealerships/${data.dealership.id}`);
    expect(list.body.data).toEqual([]);
    expect(detail.status).toBe(404);
    const stillThere = await staffGet(`/api/admin/dealerships/${data.dealership.id}`);
    expect(stillThere.body.data.isActive).toBe(false);
  });

  it.each(['PENDING', 'APPROVED', 'RESCHEDULED'] as const)(
    'is blocked by a future %s booking with 409 HAS_ACTIVE_BOOKINGS and the count',
    async status => {
      const second = await createSlot(data, 6, 10);
      await createBooking(data.customer.id, data.slot.id, status);
      await createBooking(data.customer.id, second.id, 'PENDING');
      const res = await deactivate();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HAS_ACTIVE_BOOKINGS');
      expect(res.body.error.message).toContain('2 upcoming active bookings');
      expect(res.body.error.details).toEqual([{ field: 'activeBookingCount', message: '2' }]);
      const stored = await prisma.dealership.findUniqueOrThrow({
        where: { id: data.dealership.id },
      });
      expect(stored.isActive).toBe(true);
    },
  );

  it('uses the singular in the message for one booking', async () => {
    await createBooking(data.customer.id, data.slot.id, 'PENDING');
    const res = await deactivate();

    expect(res.body.error.message).toContain('1 upcoming active booking.');
  });

  it('is not blocked by past, final or other-dealership bookings', async () => {
    const past = await createSlot(data, -3, 10);
    const cancelled = await createSlot(data, 5, 10);
    const completed = await createSlot(data, 6, 10);
    await createBooking(data.customer.id, past.id, 'APPROVED');
    await createBooking(data.customer.id, cancelled.id, 'CANCELLED');
    await createBooking(data.customer.id, completed.id, 'REJECTED');

    const other = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(other.id, data.vehicle.id);
    const elsewhere = await createSlot({ ...data, dealership: other }, 9, 14);
    await createBooking(data.customer.id, elsewhere.id, 'PENDING');

    const res = await deactivate();

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('keeps existing slots and booking history intact', async () => {
    const past = await createSlot(data, -3, 10);
    const booking = await createBooking(data.customer.id, past.id, 'COMPLETED');
    await deactivate();

    expect(await prisma.timeSlot.count({ where: { dealershipId: data.dealership.id } })).toBe(2);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.status).toBe('COMPLETED');
  });

  it('is idempotent for an already inactive dealership', async () => {
    await deactivate();
    const again = await deactivate();

    expect(again.status).toBe(200);
    expect(again.body.data.isActive).toBe(false);
  });

  it('activates a dealership again and shows it to customers', async () => {
    await deactivate();
    const res = await activate();

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
    const list = await request(app).get('/api/dealerships');
    expect(list.body.data).toHaveLength(1);
  });

  it('activating an active dealership is harmless', async () => {
    expect((await activate()).status).toBe(200);
  });

  it('returns 404 for unknown dealerships', async () => {
    const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';

    expect((await deactivate(id)).status).toBe(404);
    expect((await activate(id)).status).toBe(404);
  });

  it('has no hard delete', async () => {
    const res = await request(app)
      .delete(`/api/admin/dealerships/${data.dealership.id}`)
      .set('Cookie', staffCookie);

    expect(res.status).toBe(404);
    expect(await prisma.dealership.count()).toBe(1);
  });
});

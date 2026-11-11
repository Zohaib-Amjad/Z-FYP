import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import {
  createBooking,
  createCustomer,
  createDealership,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';
import { addSlot, utcInstant } from './helpers/slots';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;
let customerCookie: string;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
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
const iso = (daysFromNow: number, hour: number, minute = 0): string =>
  utcInstant(daysFromNow, hour, minute).toISOString();
const slotBody = (overrides: object = {}) => ({
  dealershipId: data.dealership.id,
  vehicleId: data.vehicle.id,
  startAt: iso(3, 10),
  endAt: iso(3, 11),
  ...overrides,
});
const fieldsOf = (res: request.Response): string[] =>
  res.body.error.details.map((d: { field: string }) => d.field);

describe('access control', () => {
  const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';
  const send = (method: string, url: string): request.Test =>
    method === 'get'
      ? request(app).get(url)
      : method === 'post'
        ? request(app).post(url)
        : request(app).patch(url);
  const calls: [string, string][] = [
    ['get', '/api/admin/slots'],
    ['get', `/api/admin/slots/${id}`],
    ['post', '/api/admin/slots'],
    ['post', '/api/admin/slots/bulk'],
    ['patch', `/api/admin/slots/${id}`],
    ['patch', `/api/admin/slots/${id}/deactivate`],
    ['patch', `/api/admin/slots/${id}/activate`],
  ];

  it.each(calls)('%s %s requires authentication', async (method, url) => {
    expect((await send(method, url)).status).toBe(401);
  });

  it.each(calls)('%s %s is forbidden to customers', async (method, url) => {
    expect((await send(method, url).set('Cookie', customerCookie)).status).toBe(403);
  });
});

describe('GET /api/admin/slots', () => {
  let manchester: { id: string };
  let other: Awaited<ReturnType<typeof createVehicle>>;
  let free: { id: string };
  let booked: { id: string };
  let inactive: { id: string };

  beforeEach(async () => {
    manchester = await createDealership('Prestige Deansgate', 'Manchester');
    other = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(manchester.id, other.id);
    free = await addSlot(data, utcInstant(2, 9));
    booked = await addSlot(data, utcInstant(3, 9));
    inactive = await addSlot(data, utcInstant(4, 9), { isActive: false });
    await addSlot({ ...data, dealership: manchester, vehicle: other }, utcInstant(5, 9));
    await createBooking(data.customer.id, booked.id, 'APPROVED');
  });

  const ids = (res: request.Response): string[] =>
    res.body.data.items.map((s: { id: string }) => s.id);

  it('lists slots, including inactive ones, with vehicle, dealership and active booking', async () => {
    const res = await staffGet('/api/admin/slots');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 4, page: 1, pageSize: 10 });
    expect(ids(res).slice(0, 3)).toEqual([free.id, booked.id, inactive.id]);
    const bookedItem = res.body.data.items[1];
    expect(bookedItem).toMatchObject({
      isActive: true,
      dealership: { name: 'Prestige Mayfair', city: 'London' },
      vehicle: { manufacturer: 'Porsche', model: '911 Carrera T' },
      activeBooking: {
        status: 'APPROVED',
        customer: { firstName: 'Amelia', lastName: 'Hart', email: 'customer@example.test' },
      },
    });
    expect(res.body.data.items[0].activeBooking).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('filters by dealership and vehicle', async () => {
    const byDealership = await staffGet(`/api/admin/slots?dealershipId=${manchester.id}`);
    const byVehicle = await staffGet(`/api/admin/slots?vehicleId=${data.vehicle.id}`);

    expect(byDealership.body.data.total).toBe(1);
    expect(byVehicle.body.data.total).toBe(3);
  });

  it('filters by date range', async () => {
    const from = encodeURIComponent(iso(3, 0));
    const to = encodeURIComponent(iso(4, 23));
    const res = await staffGet(`/api/admin/slots?from=${from}&to=${to}`);

    expect(ids(res)).toEqual([booked.id, inactive.id]);
  });

  it('filters by active status', async () => {
    const off = await staffGet('/api/admin/slots?isActive=false');
    const on = await staffGet('/api/admin/slots?isActive=true');

    expect(ids(off)).toEqual([inactive.id]);
    expect(on.body.data.total).toBe(3);
  });

  it('filters by whether a slot has an active booking', async () => {
    const withBooking = await staffGet('/api/admin/slots?hasBooking=true');
    const without = await staffGet('/api/admin/slots?hasBooking=false');

    expect(ids(withBooking)).toEqual([booked.id]);
    expect(without.body.data.total).toBe(3);
  });

  it('does not count cancelled bookings as active', async () => {
    await prisma.booking.updateMany({ data: { status: 'CANCELLED' } });
    const res = await staffGet('/api/admin/slots?hasBooking=true');

    expect(res.body.data.total).toBe(0);
    const all = await staffGet('/api/admin/slots');
    expect(
      all.body.data.items.every((s: { activeBooking: unknown }) => s.activeBooking === null),
    ).toBe(true);
  });

  it('paginates and sorts', async () => {
    const first = await staffGet('/api/admin/slots?pageSize=3&page=1&sortOrder=desc');
    const second = await staffGet('/api/admin/slots?pageSize=3&page=2&sortOrder=desc');

    expect(first.body.data).toMatchObject({ total: 4, totalPages: 2 });
    expect(ids(first)[0]).not.toBe(free.id);
    expect(ids(second)).toEqual([free.id]);
  });

  it('rejects invalid parameters', async () => {
    const badRange = await staffGet(
      `/api/admin/slots?from=${encodeURIComponent(iso(5, 0))}&to=${encodeURIComponent(iso(1, 0))}`,
    );

    expect(badRange.status).toBe(422);
    for (const query of [
      'from=yesterday',
      'isActive=maybe',
      'hasBooking=2',
      'vehicleId=abc',
      'pageSize=500',
      'sortBy=x',
    ]) {
      expect((await staffGet(`/api/admin/slots?${query}`)).status, query).toBe(422);
    }
  });

  it('returns a single slot, or 404', async () => {
    const found = await staffGet(`/api/admin/slots/${booked.id}`);

    expect(found.status).toBe(200);
    expect(found.body.data.activeBooking.status).toBe('APPROVED');
    expect((await staffGet('/api/admin/slots/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status).toBe(
      404,
    );
  });
});

describe('POST /api/admin/slots', () => {
  it('creates a slot, storing UTC and recording who created it', async () => {
    const res = await staffPost('/api/admin/slots', slotBody());

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      isActive: true,
      startAt: iso(3, 10),
      endAt: iso(3, 11),
      dealership: { id: data.dealership.id },
      vehicle: { id: data.vehicle.id },
      activeBooking: null,
    });
    const stored = await prisma.timeSlot.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(stored.createdById).toBe(data.staff.id);
  });

  it('converts offsets to UTC', async () => {
    const start = utcInstant(3, 10);
    const local = (date: Date): string =>
      date
        .toISOString()
        .replace('Z', '+05:00')
        .replace(/T\d\d/, `T${String(date.getUTCHours() + 5).padStart(2, '0')}`);
    const res = await staffPost(
      '/api/admin/slots',
      slotBody({ startAt: local(start), endAt: local(utcInstant(3, 11)) }),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.startAt).toBe(start.toISOString());
  });

  it('rejects a start time in the past with SLOT_IN_PAST', async () => {
    const res = await staffPost(
      '/api/admin/slots',
      slotBody({ startAt: iso(-1, 10), endAt: iso(-1, 11) }),
    );

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SLOT_IN_PAST');
    expect(await prisma.timeSlot.count()).toBe(0);
  });

  it.each([
    ['end equal to start', iso(3, 10), iso(3, 10)],
    ['end before start', iso(3, 10), iso(3, 9)],
    ['a duration under 15 minutes', iso(3, 10), iso(3, 10, 14)],
    ['a duration over 240 minutes', iso(3, 10), iso(3, 14, 1)],
  ])('rejects %s', async (_label, startAt, endAt) => {
    const res = await staffPost('/api/admin/slots', slotBody({ startAt, endAt }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fieldsOf(res)).toContain('endAt');
  });

  it('accepts the shortest and longest allowed durations', async () => {
    const short = await staffPost(
      '/api/admin/slots',
      slotBody({ startAt: iso(3, 9), endAt: iso(3, 9, 15) }),
    );
    const long = await staffPost(
      '/api/admin/slots',
      slotBody({ startAt: iso(4, 9), endAt: iso(4, 13) }),
    );

    expect(short.status).toBe(201);
    expect(long.status).toBe(201);
  });

  it('requires ISO date-times with an offset', async () => {
    for (const startAt of ['2030-01-01', '2030-01-01T10:00:00', 'tomorrow', 12345, null]) {
      const res = await staffPost('/api/admin/slots', slotBody({ startAt }));
      expect(res.status, String(startAt)).toBe(422);
    }
  });

  it('validates identifiers and rejects unknown fields', async () => {
    const res = await staffPost('/api/admin/slots', {
      ...slotBody({ dealershipId: 'abc' }),
      isActive: false,
    });

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toEqual(expect.arrayContaining(['dealershipId', 'isActive']));
    const missing = await staffPost('/api/admin/slots', {});
    expect(fieldsOf(missing)).toEqual(
      expect.arrayContaining(['dealershipId', 'vehicleId', 'startAt', 'endAt']),
    );
  });

  it('rejects unknown dealerships and vehicles', async () => {
    const res = await staffPost(
      '/api/admin/slots',
      slotBody({
        dealershipId: '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11',
        vehicleId: '1bbe7e55-75e7-4355-b1e3-af30b7b9ee11',
      }),
    );

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      { field: 'dealershipId', message: 'Dealership not found' },
      { field: 'vehicleId', message: 'Vehicle not found' },
    ]);
  });

  it('refuses new slots for a deactivated dealership or vehicle', async () => {
    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { isActive: false },
    });
    const dealership = await staffPost('/api/admin/slots', slotBody());
    await prisma.dealership.update({ where: { id: data.dealership.id }, data: { isActive: true } });
    await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: false } });
    const vehicle = await staffPost('/api/admin/slots', slotBody());

    expect(dealership.status).toBe(422);
    expect(dealership.body.error.details).toEqual([
      { field: 'dealershipId', message: 'Dealership is deactivated' },
    ]);
    expect(vehicle.status).toBe(422);
    expect(vehicle.body.error.details).toEqual([
      { field: 'vehicleId', message: 'Vehicle is deactivated' },
    ]);
    expect(await prisma.timeSlot.count()).toBe(0);
  });

  it('refuses a vehicle that is not offered at the dealership', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    const notLinked = await staffPost(
      '/api/admin/slots',
      slotBody({ dealershipId: manchester.id }),
    );
    await linkVehicle(manchester.id, data.vehicle.id, false);
    const unavailable = await staffPost(
      '/api/admin/slots',
      slotBody({ dealershipId: manchester.id }),
    );

    for (const res of [notLinked, unavailable]) {
      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual([
        { field: 'vehicleId', message: 'This vehicle is not offered at this dealership' },
      ]);
    }
  });

  describe('overlap rules', () => {
    let existing: { id: string };

    beforeEach(async () => {
      existing = await addSlot(data, utcInstant(3, 10));
    });

    it.each([
      ['an identical slot', iso(3, 10), iso(3, 11)],
      ['a slot starting inside it', iso(3, 10, 30), iso(3, 11, 30)],
      ['a slot ending inside it', iso(3, 9, 30), iso(3, 10, 30)],
      ['a slot containing it', iso(3, 9), iso(3, 12)],
      ['a slot contained by it', iso(3, 10, 15), iso(3, 10, 45)],
    ])(
      'rejects %s with 409 SLOT_OVERLAP naming the clashing slot',
      async (_label, startAt, endAt) => {
        const res = await staffPost('/api/admin/slots', slotBody({ startAt, endAt }));

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('SLOT_OVERLAP');
        expect(res.body.error.details[0].message).toContain(existing.id);
        expect(res.body.error.details[0].message).toContain('Prestige Mayfair');
        expect(await prisma.timeSlot.count()).toBe(1);
      },
    );

    it('allows back-to-back slots', async () => {
      const before = await staffPost(
        '/api/admin/slots',
        slotBody({ startAt: iso(3, 9), endAt: iso(3, 10) }),
      );
      const after = await staffPost(
        '/api/admin/slots',
        slotBody({ startAt: iso(3, 11), endAt: iso(3, 12) }),
      );

      expect(before.status).toBe(201);
      expect(after.status).toBe(201);
    });

    it('rejects an overlap with the same vehicle at another dealership', async () => {
      const manchester = await createDealership('Prestige Deansgate', 'Manchester');
      await linkVehicle(manchester.id, data.vehicle.id);
      const res = await staffPost('/api/admin/slots', slotBody({ dealershipId: manchester.id }));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLOT_OVERLAP');
    });

    it('allows the same time for a different vehicle', async () => {
      const other = await createVehicle({ model: 'Flying Spur' });
      await linkVehicle(data.dealership.id, other.id);
      const res = await staffPost('/api/admin/slots', slotBody({ vehicleId: other.id }));

      expect(res.status).toBe(201);
    });

    it('ignores inactive slots', async () => {
      await prisma.timeSlot.update({ where: { id: existing.id }, data: { isActive: false } });
      const res = await staffPost('/api/admin/slots', slotBody());

      expect(res.status).toBe(201);
    });

    it('CONCURRENCY: lets exactly one of several simultaneous identical requests succeed', async () => {
      await prisma.timeSlot.delete({ where: { id: existing.id } });
      const body = slotBody({ startAt: iso(6, 10), endAt: iso(6, 11) });
      const results = await Promise.all(
        Array.from({ length: 6 }, () => staffPost('/api/admin/slots', body)),
      );

      expect(results.filter(r => r.status === 201)).toHaveLength(1);
      const failures = results.filter(r => r.status !== 201);
      expect(failures.every(r => r.status === 409 && r.body.error.code === 'SLOT_OVERLAP')).toBe(
        true,
      );
      expect(await prisma.timeSlot.count()).toBe(1);
    });
  });
});

describe('PATCH /api/admin/slots/:id', () => {
  let slot: { id: string };
  const url = () => `/api/admin/slots/${slot.id}`;

  beforeEach(async () => {
    slot = await addSlot(data, utcInstant(3, 10));
  });

  it('changes both times', async () => {
    const res = await staffPatch(url(), { startAt: iso(4, 14), endAt: iso(4, 15) });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ startAt: iso(4, 14), endAt: iso(4, 15) });
  });

  it('changes only the end time or only the start time', async () => {
    const end = await staffPatch(url(), { endAt: iso(3, 12) });
    const start = await staffPatch(url(), { startAt: iso(3, 11) });

    expect(end.body.data).toMatchObject({ startAt: iso(3, 10), endAt: iso(3, 12) });
    expect(start.body.data).toMatchObject({ startAt: iso(3, 11), endAt: iso(3, 12) });
  });

  it('allows moving a slot partly over its own previous time', async () => {
    const res = await staffPatch(url(), { startAt: iso(3, 10, 30), endAt: iso(3, 11, 30) });

    expect(res.status).toBe(200);
  });

  it.each(['PENDING', 'APPROVED', 'RESCHEDULED'] as const)(
    'is blocked by an active %s booking',
    async status => {
      await createBooking(data.customer.id, slot.id, status);
      const res = await staffPatch(url(), { startAt: iso(4, 10), endAt: iso(4, 11) });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HAS_ACTIVE_BOOKINGS');
      expect(res.body.error.message).toContain('Reschedule the booking');
      const stored = await prisma.timeSlot.findUniqueOrThrow({ where: { id: slot.id } });
      expect(stored.startAt.toISOString()).toBe(iso(3, 10));
    },
  );

  it('is allowed once the booking has been cancelled', async () => {
    await createBooking(data.customer.id, slot.id, 'CANCELLED');
    const res = await staffPatch(url(), { endAt: iso(3, 12) });

    expect(res.status).toBe(200);
  });

  it('refuses to change a slot that has already started', async () => {
    const past = await addSlot(data, new Date(Date.now() - 10 * 60_000), {
      endAt: new Date(Date.now() + 50 * 60_000),
    });
    const res = await staffPatch(`/api/admin/slots/${past.id}`, { endAt: iso(0, 23) });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_IN_PAST');
  });

  it('rejects a new start time in the past', async () => {
    const res = await staffPatch(url(), { startAt: iso(-1, 10), endAt: iso(-1, 11) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SLOT_IN_PAST');
  });

  it('applies the same range rules as creation', async () => {
    const reversed = await staffPatch(url(), { startAt: iso(3, 12) });
    const tooShort = await staffPatch(url(), { endAt: iso(3, 10, 5) });
    const tooLong = await staffPatch(url(), { endAt: iso(3, 20) });

    expect([reversed.status, tooShort.status, tooLong.status]).toEqual([422, 422, 422]);
  });

  it('rejects a change that would overlap another active slot', async () => {
    const neighbour = await addSlot(data, utcInstant(3, 12));
    const res = await staffPatch(url(), { endAt: iso(3, 12, 30) });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_OVERLAP');
    expect(res.body.error.details[0].message).toContain(neighbour.id);
  });

  it('does not check overlaps for an inactive slot', async () => {
    await addSlot(data, utcInstant(3, 12));
    await prisma.timeSlot.update({ where: { id: slot.id }, data: { isActive: false } });
    const res = await staffPatch(url(), { endAt: iso(3, 12, 30) });

    expect(res.status).toBe(200);
  });

  it('validates the body and returns 404 for an unknown slot', async () => {
    expect((await staffPatch(url(), {})).status).toBe(422);
    expect((await staffPatch(url(), { startAt: 'soon' })).status).toBe(422);
    expect((await staffPatch(url(), { isActive: false })).status).toBe(422);
    expect((await staffPatch(url(), { dealershipId: data.dealership.id })).status).toBe(422);
    expect(
      (
        await staffPatch('/api/admin/slots/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', {
          endAt: iso(3, 12),
        })
      ).status,
    ).toBe(404);
    expect((await staffPatch('/api/admin/slots/nope', { endAt: iso(3, 12) })).status).toBe(422);
  });
});

describe('deactivate and activate', () => {
  let slot: { id: string };
  const deactivate = (id = slot.id) => staffPatch(`/api/admin/slots/${id}/deactivate`);
  const activate = (id = slot.id) => staffPatch(`/api/admin/slots/${id}/activate`);

  beforeEach(async () => {
    slot = await addSlot(data, utcInstant(3, 10));
  });

  it('deactivates a free slot and removes it from customer availability', async () => {
    const res = await deactivate();

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    const available = await request(app).get(`/api/vehicles/${data.vehicle.id}/slots`);
    expect(available.body.data.dates).toEqual([]);
    expect((await staffGet(`/api/admin/slots/${slot.id}`)).body.data.isActive).toBe(false);
  });

  it.each(['PENDING', 'APPROVED', 'RESCHEDULED'] as const)(
    'refuses to deactivate a slot with an active %s booking',
    async status => {
      await createBooking(data.customer.id, slot.id, status);
      const res = await deactivate();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HAS_ACTIVE_BOOKINGS');
      const stored = await prisma.timeSlot.findUniqueOrThrow({ where: { id: slot.id } });
      expect(stored.isActive).toBe(true);
    },
  );

  it('refuses even when the booked slot is already in the past', async () => {
    const past = await addSlot(data, utcInstant(-2, 10));
    await createBooking(data.customer.id, past.id, 'APPROVED');

    expect((await deactivate(past.id)).status).toBe(409);
  });

  it('deactivates a slot whose bookings are all finished', async () => {
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    await createBooking(data.customer.id, slot.id, 'CANCELLED');
    await createBooking(other.id, slot.id, 'REJECTED');

    expect((await deactivate()).status).toBe(200);
  });

  it('is idempotent and returns 404 for unknown slots', async () => {
    await deactivate();

    expect((await deactivate()).status).toBe(200);
    expect((await deactivate('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status).toBe(404);
    expect((await activate('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status).toBe(404);
  });

  it('reactivates a slot and shows it to customers again', async () => {
    await deactivate();
    const res = await activate();

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
    const available = await request(app).get(`/api/vehicles/${data.vehicle.id}/slots`);
    expect(available.body.data.dates).toHaveLength(1);
  });

  it('activating an active slot is harmless', async () => {
    expect((await activate()).status).toBe(200);
  });

  it('re-checks overlap on activation', async () => {
    await deactivate();
    const replacement = await addSlot(data, utcInstant(3, 10, 30));
    const res = await activate();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_OVERLAP');
    expect(res.body.error.details[0].message).toContain(replacement.id);
    const stored = await prisma.timeSlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(stored.isActive).toBe(false);
  });

  it('allows activation when the overlapping slot is itself inactive', async () => {
    await deactivate();
    await addSlot(data, utcInstant(3, 10, 30), { isActive: false });

    expect((await activate()).status).toBe(200);
  });
});

import type { BookingStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import {
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
let ids: Record<string, string>;
let nameOf: Map<string, string>;

const DAY = 86_400_000;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
  staffCookie = authCookie(data.staff);
  await buildFixture();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const get = (query = '', cookie = staffCookie) =>
  request(app).get(`/api/admin/bookings${query}`).set('Cookie', cookie);
const namesOf = (res: request.Response): string[] =>
  res.body.data.items.map((item: { id: string }) => nameOf.get(item.id) ?? `UNKNOWN:${item.id}`);
const sorted = (values: string[]): string[] => [...values].sort();
const iso = (date: Date): string => encodeURIComponent(date.toISOString());

async function buildFixture(): Promise<void> {
  const mayfair = data.dealership;
  const manchester = await createDealership('Prestige Deansgate', 'Manchester');
  const audi = await createVehicle({ manufacturer: 'Audi', model: 'RS e-tron GT' });
  const bentley = await createVehicle({ manufacturer: 'Bentley', model: 'Continental GT Speed' });
  for (const vehicle of [audi, bentley]) {
    await linkVehicle(mayfair.id, vehicle.id);
    await linkVehicle(manchester.id, vehicle.id);
  }
  await linkVehicle(manchester.id, data.vehicle.id);
  const amelia = data.customer;
  const isabella = await createCustomer(
    'isabella.rossi@example.test',
    'Isabella',
    'Rossi',
    '+44 7700 900555',
  );
  const oliver = await createCustomer(
    'oliver.bennett@example.test',
    'Oliver',
    'Bennett',
    '+44 7700 900222',
  );
  const porsche = data.vehicle;
  const target = (vehicle: { id: string }, dealership: { id: string }) => ({
    staff: data.staff,
    vehicle,
    dealership,
  });

  const spec: [string, { id: string }, BookingStatus, ReturnType<typeof target>, number, number][] =
    [
      ['b1', amelia, 'PENDING', target(porsche, mayfair), 3, 5],
      ['b2', amelia, 'APPROVED', target(audi, manchester), 5, 4],
      ['b3', isabella, 'REJECTED', target(porsche, mayfair), 7, 3],
      ['b4', isabella, 'COMPLETED', target(bentley, mayfair), -4, 10],
      ['b5', oliver, 'CANCELLED', target(audi, manchester), 9, 2],
      ['b6', oliver, 'RESCHEDULED', target(porsche, mayfair), 11, 1],
      ['b7', amelia, 'COMPLETED', target(bentley, manchester), -8, 20],
      ['b8', isabella, 'PENDING', target(audi, manchester), 13, 0],
      ['b9', oliver, 'APPROVED', target(bentley, mayfair), -2, 6],
      ['b10', amelia, 'CANCELLED', target(porsche, mayfair), -6, 15],
    ];
  ids = {};
  nameOf = new Map();
  for (const [name, customer, status, slotTarget, slotDays, createdDaysAgo] of spec) {
    const slot = await addSlot(slotTarget, utcInstant(slotDays, 10));
    const createdAt = new Date(Date.now() - (createdDaysAgo === 0 ? 60_000 : createdDaysAgo * DAY));
    const booking = await prisma.booking.create({
      data: { customerId: customer.id, slotId: slot.id, status, createdAt },
    });
    ids[name] = booking.id;
    nameOf.set(booking.id, name);
  }
}

const CREATED_DESC = ['b8', 'b6', 'b5', 'b3', 'b2', 'b1', 'b9', 'b4', 'b10', 'b7'];
const SLOT_START_ASC = ['b7', 'b10', 'b4', 'b9', 'b1', 'b2', 'b3', 'b5', 'b6', 'b8'];

describe('GET /api/admin/bookings: basics', () => {
  it('lists every booking, newest first by default, with the documented item shape', async () => {
    const res = await get('?pageSize=50');

    expect(res.status).toBe(200);
    expect(namesOf(res)).toEqual(CREATED_DESC);
    expect(res.body.data).toMatchObject({ total: 10, page: 1, pageSize: 50, totalPages: 1 });
    const item = res.body.data.items.find((i: { id: string }) => i.id === ids.b2);
    expect(item).toMatchObject({
      id: ids.b2,
      status: 'APPROVED',
      customer: {
        id: data.customer.id,
        name: 'Amelia Hart',
        email: 'customer@example.test',
        phone: '+44 7700 900111',
      },
      vehicle: { manufacturer: 'Audi', model: 'RS e-tron GT', name: 'Audi RS e-tron GT' },
      dealership: { name: 'Prestige Deansgate', city: 'Manchester' },
      slot: { startAt: utcInstant(5, 10).toISOString(), endAt: utcInstant(5, 11).toISOString() },
      customerNote: null,
      staffNote: null,
    });
    expect(typeof item.createdAt).toBe('string');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('includes the notes and reasons', async () => {
    await prisma.booking.update({
      where: { id: ids.b3 },
      data: { customerNote: 'Weekend drive', rejectionReason: 'Reserved for a press event' },
    });
    await prisma.booking.update({
      where: { id: ids.b10 },
      data: {
        cancellationReason: 'Plans changed',
        cancelledBy: 'CUSTOMER',
        staffNote: 'Called customer',
      },
    });
    const res = await get('?pageSize=50');
    const item = (name: string) =>
      res.body.data.items.find((i: { id: string }) => i.id === ids[name]);

    expect(item('b3')).toMatchObject({
      customerNote: 'Weekend drive',
      rejectionReason: 'Reserved for a press event',
    });
    expect(item('b10')).toMatchObject({
      cancellationReason: 'Plans changed',
      cancelledBy: 'CUSTOMER',
      staffNote: 'Called customer',
    });
  });

  it('includes the vehicle primary image', async () => {
    await prisma.vehicleImage.create({
      data: {
        vehicleId: data.vehicle.id,
        url: '/uploads/x/1.png',
        altText: 'Front',
        isPrimary: true,
      },
    });
    const res = await get('?customerId=' + data.customer.id + '&vehicleId=' + data.vehicle.id);

    expect(res.body.data.items[0].vehicle.primaryImage).toEqual({
      url: '/uploads/x/1.png',
      altText: 'Front',
    });
  });

  it('returns an empty page for no match', async () => {
    const res = await get('?q=zzzzzz');

    expect(res.body.data).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });
});

describe('GET /api/admin/bookings: filters', () => {
  it('filters by one status, by several (comma or repeated), case as given', async () => {
    expect(sorted(namesOf(await get('?status=PENDING')))).toEqual(['b1', 'b8']);
    expect(sorted(namesOf(await get('?status=PENDING,APPROVED')))).toEqual([
      'b1',
      'b2',
      'b8',
      'b9',
    ]);
    expect(sorted(namesOf(await get('?status=PENDING&status=APPROVED')))).toEqual([
      'b1',
      'b2',
      'b8',
      'b9',
    ]);
    expect(sorted(namesOf(await get('?status=CANCELLED,REJECTED')))).toEqual(['b10', 'b3', 'b5']);
  });

  it.each([
    ['dealership (Manchester)', 'dealershipId', () => 'MANCHESTER', ['b2', 'b5', 'b7', 'b8']],
    ['vehicle (Audi)', 'vehicleId', () => 'AUDI', ['b2', 'b5', 'b8']],
    ['customer (Amelia)', 'customerId', () => 'AMELIA', ['b1', 'b10', 'b2', 'b7']],
  ])('filters by %s', async (_label, param, which, expected) => {
    const value =
      which() === 'MANCHESTER'
        ? (await prisma.dealership.findFirstOrThrow({ where: { city: 'Manchester' } })).id
        : which() === 'AUDI'
          ? (await prisma.vehicle.findFirstOrThrow({ where: { manufacturer: 'Audi' } })).id
          : data.customer.id;
    const res = await get(`?${param}=${value}`);

    expect(sorted(namesOf(res))).toEqual(expected);
  });

  it.each([
    ['first name', 'amelia', ['b1', 'b10', 'b2', 'b7']],
    ['last name, upper case', 'ROSSI', ['b3', 'b4', 'b8']],
    ['email fragment', 'oliver.bennett', ['b5', 'b6', 'b9']],
    ['phone fragment', '900555', ['b3', 'b4', 'b8']],
    ['vehicle make', 'audi', ['b2', 'b5', 'b8']],
    ['vehicle model', 'e-tron', ['b2', 'b5', 'b8']],
    ['vehicle make and model together', 'porsche 911', ['b1', 'b10', 'b3', 'b6']],
    ['customer and vehicle together', 'amelia audi', ['b2']],
    ['another customer and vehicle', 'isabella bentley', ['b4']],
  ])('searches by %s', async (_label, q, expected) => {
    const res = await get(`?q=${encodeURIComponent(q)}`);

    expect(sorted(namesOf(res))).toEqual(expected);
  });

  it('treats wildcard characters in the search literally', async () => {
    expect((await get('?q=%25')).body.data.total).toBe(0);
    expect((await get('?q=_')).body.data.total).toBe(0);
  });

  it('filters by slot start date range (inclusive)', async () => {
    const res = await get(`?dateFrom=${iso(utcInstant(-5, 0))}&dateTo=${iso(utcInstant(6, 0))}`);

    expect(sorted(namesOf(res))).toEqual(['b1', 'b2', 'b4', 'b9']);
    const exactEdge = await get(
      `?dateFrom=${iso(utcInstant(5, 10))}&dateTo=${iso(utcInstant(5, 10))}`,
    );
    expect(namesOf(exactEdge)).toEqual(['b2']);
    expect(sorted(namesOf(await get(`?dateFrom=${iso(utcInstant(9, 0))}`)))).toEqual([
      'b5',
      'b6',
      'b8',
    ]);
    expect(sorted(namesOf(await get(`?dateTo=${iso(utcInstant(-5, 0))}`)))).toEqual(['b10', 'b7']);
  });

  it('filters by created date range', async () => {
    const from = iso(new Date(Date.now() - 5.5 * DAY));
    const to = iso(new Date(Date.now() - 1.5 * DAY));
    const res = await get(`?createdFrom=${from}&createdTo=${to}`);

    expect(sorted(namesOf(res))).toEqual(['b1', 'b2', 'b3', 'b5']);
  });

  it('upcomingOnly keeps bookings whose slot is in the future, whatever their status', async () => {
    const res = await get('?upcomingOnly=true');

    expect(sorted(namesOf(res))).toEqual(['b1', 'b2', 'b3', 'b5', 'b6', 'b8']);
    expect((await get('?upcomingOnly=false&pageSize=50')).body.data.total).toBe(10);
  });

  it('combines filters', async () => {
    const manchester = (await prisma.dealership.findFirstOrThrow({ where: { city: 'Manchester' } }))
      .id;
    expect(
      sorted(namesOf(await get(`?status=PENDING,APPROVED&dealershipId=${manchester}`))),
    ).toEqual(['b2', 'b8']);
    expect(namesOf(await get(`?status=COMPLETED&customerId=${data.customer.id}`))).toEqual(['b7']);
    expect(namesOf(await get('?status=CANCELLED&upcomingOnly=true'))).toEqual(['b5']);
    expect(namesOf(await get('?q=porsche&status=CANCELLED,REJECTED'))).toEqual(['b3', 'b10']);
    expect(namesOf(await get(`?q=amelia&upcomingOnly=true&sort=slotStartAsc`))).toEqual([
      'b1',
      'b2',
    ]);
    expect((await get(`?status=COMPLETED&upcomingOnly=true`)).body.data.total).toBe(0);
  });
});

describe('GET /api/admin/bookings: sorting and pagination', () => {
  it('sorts by creation date (newest first), or by slot start either way', async () => {
    expect(namesOf(await get('?sort=createdDesc&pageSize=50'))).toEqual(CREATED_DESC);
    expect(namesOf(await get('?sort=slotStartAsc&pageSize=50'))).toEqual(SLOT_START_ASC);
    expect(namesOf(await get('?sort=slotStartDesc&pageSize=50'))).toEqual(
      [...SLOT_START_ASC].reverse(),
    );
  });

  it('paginates consistently', async () => {
    const pages = await Promise.all([1, 2, 3].map(page => get(`?pageSize=4&page=${page}`)));

    expect(pages[0].body.data).toMatchObject({ total: 10, totalPages: 3, pageSize: 4 });
    expect(pages.flatMap(namesOf)).toEqual(CREATED_DESC);
    expect(namesOf(pages[2])).toHaveLength(2);
  });

  it('returns an empty page beyond the last, with the true total', async () => {
    const res = await get('?page=9&pageSize=10');

    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(10);
  });

  it('paginates a filtered result', async () => {
    const first = await get('?status=PENDING,APPROVED&pageSize=3&page=1&sort=slotStartAsc');
    const second = await get('?status=PENDING,APPROVED&pageSize=3&page=2&sort=slotStartAsc');

    expect(namesOf(first)).toEqual(['b9', 'b1', 'b2']);
    expect(namesOf(second)).toEqual(['b8']);
    expect(first.body.data.total).toBe(4);
  });
});

describe('GET /api/admin/bookings: validation and access', () => {
  it('explains valid statuses and sorts when given an invalid one', async () => {
    const status = await get('?status=PENDING,DONE');
    const sort = await get('?sort=random');

    expect(status.status).toBe(422);
    expect(status.body.error.details[0].message).toContain('PENDING, APPROVED, REJECTED');
    expect(sort.status).toBe(422);
    expect(sort.body.error.details[0].message).toContain('slotStartAsc');
  });

  it.each([
    'dealershipId=abc',
    'vehicleId=1',
    'customerId=x',
    'dateFrom=yesterday',
    'dateTo=2030-01-01',
    'createdFrom=now',
    'upcomingOnly=maybe',
    'page=0',
    'pageSize=51',
    'colour=red',
  ])('rejects %s', async query => {
    expect((await get(`?${query}`)).status).toBe(422);
  });

  it('rejects inverted ranges', async () => {
    const dates = await get(`?dateFrom=${iso(utcInstant(5, 0))}&dateTo=${iso(utcInstant(1, 0))}`);
    const created = await get(
      `?createdFrom=${iso(utcInstant(0, 0))}&createdTo=${iso(utcInstant(-5, 0))}`,
    );

    expect(dates.status).toBe(422);
    expect(dates.body.error.details[0].field).toBe('dateFrom');
    expect(created.status).toBe(422);
    expect(created.body.error.details[0].field).toBe('createdFrom');
  });

  it('treats empty parameters as not provided', async () => {
    const res = await get('?q=&status=&upcomingOnly=');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(10);
  });

  it('is closed to customers and anonymous callers', async () => {
    expect((await get('', authCookie(data.customer))).status).toBe(403);
    expect((await request(app).get('/api/admin/bookings')).status).toBe(401);
    expect((await request(app).get(`/api/admin/bookings/${ids.b1}`)).status).toBe(401);
    expect((await get(`/${ids.b1}`.replace('/', '/'), authCookie(data.customer))).status).toBe(403);
  });
});

describe('GET /api/admin/bookings/:id', () => {
  const detail = (id: string, cookie = staffCookie) =>
    request(app).get(`/api/admin/bookings/${id}`).set('Cookie', cookie);

  it('returns customer profile, slot, vehicle, dealership and the history with staff names', async () => {
    await prisma.user.update({
      where: { id: data.customer.id },
      data: { drivingLicenseNumber: 'HART9503126A99XY' },
    });
    const slot = await addSlot(
      { staff: data.staff, vehicle: data.vehicle, dealership: data.dealership },
      utcInstant(20, 10),
    );
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', authCookie(data.customer))
      .send({ slotId: slot.id, customerNote: 'Weekend drive' });
    const id = created.body.data.id;
    const target = await addSlot(
      { staff: data.staff, vehicle: data.vehicle, dealership: data.dealership },
      utcInstant(22, 14),
    );
    await request(app)
      .patch(`/api/admin/bookings/${id}/approve`)
      .set('Cookie', staffCookie)
      .send({ staffNote: 'Bring licence' });
    await request(app)
      .patch(`/api/admin/bookings/${id}/reschedule`)
      .set('Cookie', staffCookie)
      .send({ newSlotId: target.id, note: 'Vehicle service' });
    const res = await detail(id);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id,
      status: 'RESCHEDULED',
      customerNote: 'Weekend drive',
      staffNote: 'Vehicle service',
      customer: {
        id: data.customer.id,
        name: 'Amelia Hart',
        email: 'customer@example.test',
        phone: '+44 7700 900111',
        drivingLicenseNumber: 'HART9503126A99XY',
        isActive: true,
      },
      slot: { id: target.id, startAt: utcInstant(22, 14).toISOString() },
      vehicle: {
        name: 'Porsche 911 Carrera T',
        vehicleType: 'COUPE',
        fuelType: 'PETROL',
        color: 'Gentian Blue',
      },
      dealership: {
        name: 'Prestige Mayfair',
        email: 'mayfair@example.test',
        openingHours: 'Mon-Sat 09:00-18:00',
      },
    });
    const history = res.body.data.statusHistory;
    expect(history.map((h: { action: string }) => h.action)).toEqual([
      'CREATED',
      'APPROVED',
      'RESCHEDULED',
    ]);
    expect(history.map((h: { changedBy: { name: string } }) => h.changedBy.name)).toEqual([
      'Amelia Hart',
      'Eleanor Whitfield',
      'Eleanor Whitfield',
    ]);
    expect(history.map((h: { changedBy: { role: string } }) => h.changedBy.role)).toEqual([
      'CUSTOMER',
      'STAFF',
      'STAFF',
    ]);
    expect(history[2]).toMatchObject({
      fromStatus: 'APPROVED',
      toStatus: 'RESCHEDULED',
      note: 'Vehicle service',
      oldSlot: { id: slot.id, dealership: { name: 'Prestige Mayfair' } },
      newSlot: { id: target.id, startAt: utcInstant(22, 14).toISOString() },
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('shows the reasons of withdrawn bookings and an empty timeline when there is no history', async () => {
    await prisma.booking.update({
      where: { id: ids.b3 },
      data: { rejectionReason: 'Reserved for a press event' },
    });
    const res = await detail(ids.b3);

    expect(res.body.data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Reserved for a press event',
    });
    expect(res.body.data.statusHistory).toEqual([]);
  });

  it('returns 404 for an unknown booking and 422 for a malformed id', async () => {
    expect((await detail('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status).toBe(404);
    expect((await detail('nope')).status).toBe(422);
  });

  it('is closed to customers, even for their own booking', async () => {
    expect((await detail(ids.b1, authCookie(data.customer))).status).toBe(403);
  });

  it('does not shadow the action routes', async () => {
    const res = await request(app)
      .patch(`/api/admin/bookings/${ids.b1}/approve`)
      .set('Cookie', staffCookie)
      .send({});

    expect(res.status).toBe(200);
  });
});

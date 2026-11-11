import type { BookingStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import {
  addDaysToDate,
  dateKeyInZone,
  startOfDayInZone,
  startOfNextDayInZone,
} from '../src/utils/timeZone';
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
import { addSlot, utcInstant } from './helpers/slots';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;
let customerCookie: string;

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

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

const get = (path: string, cookie = staffCookie) =>
  request(app).get(`/api/admin/dashboard${path}`).set('Cookie', cookie);
const target = (vehicle: { id: string }, dealership: { id: string }) => ({
  staff: data.staff,
  vehicle,
  dealership,
});

describe('access control', () => {
  it.each(['/summary', '/bookings-trend', '/top-vehicles'])('%s is staff only', async path => {
    expect((await get(path, customerCookie)).status).toBe(403);
    expect((await request(app).get(`/api/admin/dashboard${path}`)).status).toBe(401);
    expect((await get(path)).status).toBe(200);
  });
});

describe('GET /api/admin/dashboard/summary', () => {
  let ids: Record<string, string>;

  beforeEach(async () => {
    const mayfair = data.dealership;
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await createDealership('Prestige Edinburgh', 'Edinburgh', { isActive: false });
    const audi = await createVehicle({ manufacturer: 'Audi', model: 'RS e-tron GT' });
    const dormant = await createVehicle({
      manufacturer: 'Bentley',
      model: 'Continental',
      isActive: false,
    });
    await linkVehicle(manchester.id, audi.id);
    await linkVehicle(mayfair.id, dormant.id);
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

    const now = Date.now();
    const todayStart = startOfDayInZone(new Date(now), 'UTC').getTime();
    const porsche = target(data.vehicle, mayfair);
    const people = [data.customer, isabella, oliver];
    const plan: [string, BookingStatus, number, number | undefined, number | undefined][] = [
      ['P1', 'PENDING', now + 2 * DAY, now - 30 * HOUR, undefined],
      ['P2', 'PENDING', now + 3 * DAY, now - 2 * HOUR, undefined],
      ['P3', 'PENDING', now + 10 * DAY, now - 50 * HOUR, undefined],
      ['A1', 'APPROVED', todayStart + MINUTE, undefined, 15 * MINUTE],
      ['C1', 'COMPLETED', todayStart + 31 * MINUTE, undefined, 15 * MINUTE],
      ['A2', 'APPROVED', now + 2 * DAY + 4 * HOUR, undefined, undefined],
      ['R1', 'RESCHEDULED', now + 5 * DAY, undefined, undefined],
      ['A3', 'APPROVED', now + 9 * DAY, undefined, undefined],
      ['A4', 'APPROVED', now - 3 * DAY, undefined, undefined],
      ['X1', 'CANCELLED', now - 5 * DAY, undefined, undefined],
      ['X2', 'REJECTED', now - 6 * DAY, undefined, undefined],
      ['C2', 'COMPLETED', now - 10 * DAY, undefined, undefined],
    ];
    ids = {};
    for (const [index, [name, status, slotStart, createdAt, length]] of plan.entries()) {
      const booking = await createBookingAt({
        customerId: people[index % people.length].id,
        target: porsche,
        status,
        slotStart: new Date(slotStart),
        slotEnd: length ? new Date(slotStart + length) : undefined,
        createdAt: createdAt ? new Date(createdAt) : undefined,
      });
      ids[name] = booking.id;
    }

    for (const offset of [1, 2, 3]) await addSlot(target(audi, manchester), utcInstant(offset, 10));
    await addSlot(target(audi, manchester), utcInstant(5, 10), { isActive: false });
    await addSlot(target(audi, manchester), utcInstant(10, 10));
    await addSlot(target(dormant, mayfair), utcInstant(2, 10));

    const thisMonth = new Date();
    const earlier = new Date(now - 40 * DAY);
    const rows: [BookingStatus, Date, number][] = [
      ['COMPLETED', thisMonth, 2],
      ['CANCELLED', thisMonth, 1],
      ['REJECTED', thisMonth, 3],
      ['APPROVED', thisMonth, 5],
      ['COMPLETED', earlier, 4],
      ['CANCELLED', earlier, 2],
      ['REJECTED', earlier, 1],
    ];
    for (const [toStatus, createdAt, count] of rows) {
      await prisma.bookingStatusHistory.createMany({
        data: Array.from({ length: count }, () => ({
          bookingId: ids.P1,
          fromStatus: 'PENDING' as const,
          toStatus,
          action: toStatus,
          changedById: data.staff.id,
          createdAt,
        })),
      });
    }
  });

  it('reports every number, matching the data', async () => {
    const res = await get('/summary');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      timeZone: 'UTC',
      pending: 3,
      todaysTestDrives: 2,
      next7Days: 2,
      approvedUpcoming: 3,
      completedThisMonth: 2,
      cancelledThisMonth: 1,
      rejectedThisMonth: 3,
      totalCustomers: 3,
      activeVehicles: 2,
      activeDealerships: 2,
      freeSlotsNext7Days: 3,
    });
    expect(Math.abs(new Date(res.body.data.generatedAt).getTime() - Date.now())).toBeLessThan(
      10_000,
    );
  });

  it('lists the bookings that need attention, oldest first, with their counts', async () => {
    const { needsAttention } = (await get('/summary')).body.data;

    expect(needsAttention.pendingOlderThan24h.count).toBe(2);
    expect(needsAttention.pendingOlderThan24h.items.map((i: { id: string }) => i.id)).toEqual([
      ids.P3,
      ids.P1,
    ]);
    expect(needsAttention.pastNotCompleted.count).toBe(2);
    expect(needsAttention.pastNotCompleted.items.map((i: { id: string }) => i.id)).toEqual([
      ids.A4,
      ids.A1,
    ]);
    expect(needsAttention.pastNotCompleted.items[0]).toMatchObject({
      status: 'APPROVED',
      customer: { name: expect.any(String), email: expect.any(String) },
      vehicle: { name: 'Porsche 911 Carrera T' },
      dealership: { name: 'Prestige Mayfair' },
    });
  });

  it('counts a RESCHEDULED booking whose slot has passed as needing attention too', async () => {
    await prisma.booking.update({ where: { id: ids.R1 }, data: { status: 'RESCHEDULED' } });
    await prisma.timeSlot.updateMany({
      where: { bookings: { some: { id: ids.R1 } } },
      data: {
        startAt: new Date(Date.now() - 4 * DAY),
        endAt: new Date(Date.now() - 4 * DAY + HOUR),
      },
    });
    const { needsAttention, approvedUpcoming } = (await get('/summary')).body.data;

    expect(needsAttention.pastNotCompleted.count).toBe(3);
    expect(approvedUpcoming).toBe(2);
  });

  it('follows the data as it changes', async () => {
    await request(app)
      .patch(`/api/admin/bookings/${ids.P1}/approve`)
      .set('Cookie', staffCookie)
      .send({});
    const after = (await get('/summary')).body.data;

    expect(after.pending).toBe(2);
    expect(after.approvedUpcoming).toBe(4);
    expect(after.next7Days).toBe(3);
    expect(after.needsAttention.pendingOlderThan24h.count).toBe(1);
  });

  it('limits each attention list to ten items while still reporting the full count', async () => {
    for (let index = 0; index < 12; index += 1) {
      await createBookingAt({
        customerId: data.customer.id,
        target: target(data.vehicle, data.dealership),
        status: 'PENDING',
        slotStart: new Date(Date.now() + (20 + index) * DAY),
        createdAt: new Date(Date.now() - (60 + index) * HOUR),
      });
    }
    const { needsAttention } = (await get('/summary')).body.data;

    expect(needsAttention.pendingOlderThan24h.count).toBe(14);
    expect(needsAttention.pendingOlderThan24h.items).toHaveLength(10);
  });

  it('reports zeros on an empty system', async () => {
    await prisma.notification.deleteMany();
    await prisma.bookingStatusHistory.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.timeSlot.deleteMany();
    const res = await get('/summary');

    expect(res.body.data).toMatchObject({
      pending: 0,
      todaysTestDrives: 0,
      next7Days: 0,
      approvedUpcoming: 0,
      completedThisMonth: 0,
      freeSlotsNext7Days: 0,
    });
    expect(res.body.data.needsAttention.pendingOlderThan24h).toEqual({ count: 0, items: [] });
  });

  it('rejects an unknown time zone or parameter', async () => {
    expect((await get('/summary?timeZone=Mars/Olympus')).status).toBe(422);
    expect((await get('/summary?days=3')).status).toBe(422);
  });
});

describe('summary: today and this month follow the time zone', () => {
  it('counts only test drives that fall on the local day', async () => {
    const zone = 'Asia/Karachi';
    const now = new Date();
    const dayStart = startOfDayInZone(now, zone).getTime();
    const nextDayStart = startOfNextDayInZone(now, zone).getTime();
    const porsche = target(data.vehicle, data.dealership);
    for (const slotStart of [dayStart + MINUTE, nextDayStart + MINUTE, dayStart - 30 * MINUTE]) {
      await createBookingAt({
        customerId: data.customer.id,
        target: porsche,
        status: 'APPROVED',
        slotStart: new Date(slotStart),
        slotEnd: new Date(slotStart + 15 * MINUTE),
      });
    }
    const res = await get(`/summary?timeZone=${zone}`);

    expect(res.body.data.timeZone).toBe(zone);
    expect(res.body.data.todaysTestDrives).toBe(1);
  });
});

describe('GET /api/admin/dashboard/bookings-trend', () => {
  const today = (zone = 'UTC'): string => dateKeyInZone(new Date(), zone);
  let booking: number;

  const create = async (status: BookingStatus, createdAt: Date) => {
    booking += 1;
    return createBookingAt({
      customerId: data.customer.id,
      target: target(data.vehicle, data.dealership),
      status,
      slotStart: new Date(Date.now() + (40 + booking) * DAY),
      createdAt,
    });
  };
  const daysAgoNoon = (days: number): Date => new Date(utcInstant(-days, 12));

  beforeEach(async () => {
    booking = 0;
    await create('PENDING', new Date(Date.now() - MINUTE));
    await create('PENDING', new Date(Date.now() - MINUTE));
    for (const status of ['APPROVED', 'RESCHEDULED', 'COMPLETED'] as const)
      await create(status, daysAgoNoon(1));
    for (const status of ['CANCELLED', 'REJECTED', 'PENDING'] as const)
      await create(status, daysAgoNoon(3));
    await create('COMPLETED', daysAgoNoon(8));
  });

  it('splits bookings created per day by status group, oldest day first, with empty days as zeros', async () => {
    const res = await get('/bookings-trend?days=5');
    const day = (offset: number): string => addDaysToDate(today(), offset);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ days: 5, timeZone: 'UTC' });
    expect(res.body.data.points).toEqual([
      { date: day(-4), pending: 0, confirmed: 0, completed: 0, cancelled: 0, total: 0 },
      { date: day(-3), pending: 1, confirmed: 0, completed: 0, cancelled: 2, total: 3 },
      { date: day(-2), pending: 0, confirmed: 0, completed: 0, cancelled: 0, total: 0 },
      { date: day(-1), pending: 0, confirmed: 2, completed: 1, cancelled: 0, total: 3 },
      { date: day(0), pending: 2, confirmed: 0, completed: 0, cancelled: 0, total: 2 },
    ]);
  });

  it('defaults to 14 days, zero-filled, and includes older bookings inside the window', async () => {
    const res = await get('/bookings-trend');
    const { points } = res.body.data;

    expect(res.body.data.days).toBe(14);
    expect(points).toHaveLength(14);
    expect(points.at(-1).date).toBe(today());
    expect(points.at(0).date).toBe(addDaysToDate(today(), -13));
    expect(
      points.find((p: { date: string }) => p.date === addDaysToDate(today(), -8)).completed,
    ).toBe(1);
    expect(points.filter((p: { total: number }) => p.total === 0)).toHaveLength(10);
  });

  it('adds up to the real number of bookings created in the window', async () => {
    const res = await get('/bookings-trend?days=14');
    const sum = res.body.data.points.reduce(
      (total: number, p: { total: number }) => total + p.total,
      0,
    );

    expect(sum).toBe(9);
    expect(sum).toBe(
      await prisma.booking.count({ where: { createdAt: { gte: new Date(res.body.data.from) } } }),
    );
  });

  it('can show just today', async () => {
    const res = await get('/bookings-trend?days=1');

    expect(res.body.data.points).toEqual([
      { date: today(), pending: 2, confirmed: 0, completed: 0, cancelled: 0, total: 2 },
    ]);
  });

  it('buckets by the day in the requested time zone', async () => {
    const lateYesterday = new Date(Date.UTC(...ymd(addDaysToDate(today(), -1)), 23, 30));
    await create('APPROVED', lateYesterday);
    const utc = await get('/bookings-trend?days=3');
    const karachi = await get('/bookings-trend?days=3&timeZone=Asia/Karachi');
    const totalOn = (res: request.Response, date: string): number | undefined =>
      res.body.data.points.find((p: { date: string }) => p.date === date)?.confirmed;

    expect(totalOn(utc, addDaysToDate(today(), -1))).toBe(3);
    expect(totalOn(karachi, today())).toBe(1);
    expect(karachi.body.data.timeZone).toBe('Asia/Karachi');
    expect(karachi.body.data.points.map((p: { date: string }) => p.date).at(-1)).toBe(
      today('Asia/Karachi'),
    );
  });

  it.each(['days=0', 'days=91', 'days=abc', 'days=2.5', 'timeZone=Nope/Nowhere', 'limit=3'])(
    'rejects %s',
    async query => {
      expect((await get(`/bookings-trend?${query}`)).status).toBe(422);
    },
  );

  it('accepts the maximum of 90 days', async () => {
    const res = await get('/bookings-trend?days=90');

    expect(res.status).toBe(200);
    expect(res.body.data.points).toHaveLength(90);
  });
});

const ymd = (date: string): [number, number, number] => {
  const [year, month, day] = date.split('-').map(Number);
  return [year, month - 1, day];
};

describe('GET /api/admin/dashboard/top-vehicles', () => {
  let counter = 0;

  const request_ = async (
    vehicle: { id: string },
    dealership: { id: string },
    createdDaysAgo: number,
    status: BookingStatus = 'PENDING',
  ) => {
    counter += 1;
    return createBookingAt({
      customerId: data.customer.id,
      target: target(vehicle, dealership),
      status,
      slotStart: new Date(Date.now() + (counter + 1) * DAY),
      createdAt: new Date(Date.now() - createdDaysAgo * DAY),
    });
  };

  beforeEach(async () => {
    counter = 0;
    const mayfair = data.dealership;
    const audi = await createVehicle({ manufacturer: 'Audi', model: 'RS e-tron GT' });
    const bentley = await createVehicle({ manufacturer: 'Bentley', model: 'Continental GT Speed' });
    const ferrari = await createVehicle({
      manufacturer: 'Ferrari',
      model: 'Roma Spider',
      isActive: false,
    });
    for (const vehicle of [audi, bentley, ferrari]) await linkVehicle(mayfair.id, vehicle.id);
    for (const [days, status] of [
      [1, 'PENDING'],
      [2, 'APPROVED'],
      [3, 'CANCELLED'],
      [20, 'COMPLETED'],
      [60, 'COMPLETED'],
    ] as [number, BookingStatus][]) {
      await request_(data.vehicle, mayfair, days, status);
    }
    for (const days of [1, 5, 25]) await request_(audi, mayfair, days);
    for (const days of [2, 6, 29]) await request_(bentley, mayfair, days);
    for (const days of [40, 50]) await request_(ferrari, mayfair, days);
  });

  it('ranks the most requested vehicles in the window, ties broken alphabetically', async () => {
    const res = await get('/top-vehicles');

    expect(res.status).toBe(200);
    expect(res.body.data.days).toBe(30);
    expect(
      res.body.data.items.map((i: { vehicle: { name: string }; requests: number }) => [
        i.vehicle.name,
        i.requests,
      ]),
    ).toEqual([
      ['Porsche 911 Carrera T', 4],
      ['Audi RS e-tron GT', 3],
      ['Bentley Continental GT Speed', 3],
    ]);
    expect(res.body.data.items[0].vehicle).toMatchObject({
      id: data.vehicle.id,
      manufacturer: 'Porsche',
      model: '911 Carrera T',
      year: 2025,
      isActive: true,
      primaryImage: null,
    });
  });

  it('counts requests of every status', async () => {
    const res = await get('/top-vehicles');

    expect(res.body.data.items[0].requests).toBe(4);
  });

  it('widens or narrows with the days parameter', async () => {
    const names = async (days: number) =>
      (await get(`/top-vehicles?days=${days}`)).body.data.items.map(
        (i: { vehicle: { manufacturer: string }; requests: number }) => [
          i.vehicle.manufacturer,
          i.requests,
        ],
      );

    expect(await names(90)).toEqual([
      ['Porsche', 5],
      ['Audi', 3],
      ['Bentley', 3],
      ['Ferrari', 2],
    ]);
    expect(await names(7)).toEqual([
      ['Porsche', 3],
      ['Audi', 2],
      ['Bentley', 2],
    ]);
    expect(await names(1)).toEqual([]);
  });

  it('limits the list, defaulting to five', async () => {
    const two = await get('/top-vehicles?days=90&limit=2');
    const all = await get('/top-vehicles?days=90&limit=20');

    expect(two.body.data.items).toHaveLength(2);
    expect(all.body.data.items).toHaveLength(4);
    expect((await get('/top-vehicles?days=90')).body.data.items).toHaveLength(4);
  });

  it('includes a primary image when there is one', async () => {
    await prisma.vehicleImage.create({
      data: {
        vehicleId: data.vehicle.id,
        url: '/uploads/x/1.png',
        altText: 'Front',
        isPrimary: true,
      },
    });
    const res = await get('/top-vehicles');

    expect(res.body.data.items[0].vehicle.primaryImage).toEqual(
      expect.objectContaining({ url: '/uploads/x/1.png' }),
    );
  });

  it('is empty when nothing was requested', async () => {
    await prisma.notification.deleteMany();
    await prisma.bookingStatusHistory.deleteMany();
    await prisma.booking.deleteMany();

    expect((await get('/top-vehicles')).body.data.items).toEqual([]);
  });

  it.each(['days=0', 'days=366', 'days=abc', 'limit=0', 'limit=21', 'limit=abc', 'timeZone=UTC'])(
    'rejects %s',
    async query => {
      expect((await get(`/top-vehicles?${query}`)).status).toBe(422);
    },
  );
});

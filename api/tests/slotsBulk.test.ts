import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import {
  createBooking,
  createDealership,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';
import { addSlot, shiftDate, upcomingWeekday, utcInstant } from './helpers/slots';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;
let monday: string;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
  staffCookie = authCookie(data.staff);
  monday = upcomingWeekday(1);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const body = (overrides: object = {}) => ({
  dealershipId: data.dealership.id,
  vehicleId: data.vehicle.id,
  dateFrom: monday,
  dateTo: shiftDate(monday, 6),
  daysOfWeek: ['MON', 'WED'],
  dailyStartTime: '09:00',
  dailyEndTime: '12:00',
  durationMinutes: 60,
  breakMinutes: 30,
  ...overrides,
});
const post = (payload: object, query = '') =>
  request(app).post(`/api/admin/slots/bulk${query}`).set('Cookie', staffCookie).send(payload);
const instant = (date: string, time: string): string => `${date}T${time}:00.000Z`;
const starts = (res: request.Response): string[] =>
  res.body.data.slots.map((s: { startAt: string }) => s.startAt);
const fieldsOf = (res: request.Response): string[] =>
  res.body.error.details.map((d: { field: string }) => d.field);

describe('slot generation', () => {
  it('creates slots of the given duration with breaks, only on the chosen days', async () => {
    const res = await post(body());
    const wednesday = shiftDate(monday, 2);

    expect(res.status).toBe(201);
    expect(starts(res)).toEqual([
      instant(monday, '09:00'),
      instant(monday, '10:30'),
      instant(wednesday, '09:00'),
      instant(wednesday, '10:30'),
    ]);
    expect(res.body.data.slots[0].endAt).toBe(instant(monday, '10:00'));
    expect(res.body.data.slots[1].endAt).toBe(instant(monday, '11:30'));
    expect(res.body.data).toMatchObject({
      dryRun: false,
      skipped: [],
      totals: { candidates: 4, slots: 4, skipped: 0 },
    });
  });

  it('persists every created slot as active with the staff member as creator', async () => {
    const res = await post(body());
    const stored = await prisma.timeSlot.findMany({ where: { vehicleId: data.vehicle.id } });

    expect(stored).toHaveLength(4);
    expect(stored.every(s => s.isActive && s.createdById === data.staff.id)).toBe(true);
    expect(stored.every(s => s.dealershipId === data.dealership.id)).toBe(true);
    expect(res.body.data.slots.map((s: { id: string }) => s.id).sort()).toEqual(
      stored.map(s => s.id).sort(),
    );
  });

  it('generates back-to-back slots when the break is zero', async () => {
    const res = await post(body({ daysOfWeek: ['MON'], breakMinutes: 0 }));

    expect(starts(res)).toEqual([
      instant(monday, '09:00'),
      instant(monday, '10:00'),
      instant(monday, '11:00'),
    ]);
  });

  it('defaults the break to zero', async () => {
    const res = await post(body({ daysOfWeek: ['MON'], breakMinutes: undefined }));

    expect(res.body.data.slots).toHaveLength(3);
  });

  it('drops a last slot that would not fit in the daily window', async () => {
    const res = await post(body({ daysOfWeek: ['MON'], dailyEndTime: '10:30', breakMinutes: 0 }));

    expect(starts(res)).toEqual([instant(monday, '09:00')]);
  });

  it('includes the first and last day of the range', async () => {
    const res = await post(body({ dateTo: monday, daysOfWeek: ['MON'] }));

    expect(res.body.data.totals.slots).toBe(2);
    const sundays = await post(
      body({ dateFrom: shiftDate(monday, -1), dateTo: shiftDate(monday, -1), daysOfWeek: ['SUN'] }),
    );
    expect(sundays.status).toBe(201);
  });

  it('creates nothing when no day in the range matches', async () => {
    const res = await post(body({ dateTo: monday, daysOfWeek: ['TUE'] }));

    expect(res.status).toBe(201);
    expect(res.body.data.totals).toEqual({ candidates: 0, slots: 0, skipped: 0 });
  });

  it('interprets dates and times in the given time zone', async () => {
    const res = await post(
      body({ daysOfWeek: ['MON'], dateTo: monday, timeZone: 'Asia/Karachi', breakMinutes: 0 }),
    );

    expect(starts(res)).toEqual([
      instant(monday, '04:00'),
      instant(monday, '05:00'),
      instant(monday, '06:00'),
    ]);
  });
});

describe('dry run', () => {
  it('previews the slots without writing anything', async () => {
    const res = await post(body(), '?dryRun=true');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      dryRun: true,
      skipped: [],
      totals: { candidates: 4, slots: 4, skipped: 0 },
    });
    expect(res.body.data.slots[0]).toEqual({
      startAt: instant(monday, '09:00'),
      endAt: instant(monday, '10:00'),
    });
    expect(await prisma.timeSlot.count()).toBe(0);
  });

  it('predicts exactly what the real run creates', async () => {
    await addSlot(data, new Date(instant(monday, '10:00')));
    const preview = await post(body(), '?dryRun=true');
    const real = await post(body());

    expect(starts(real)).toEqual(starts(preview));
    expect(real.body.data.skipped).toEqual(preview.body.data.skipped);
  });

  it('reports which slots would clash and with what', async () => {
    const existing = await addSlot(data, new Date(instant(monday, '10:00')));
    const res = await post(body({ daysOfWeek: ['MON'] }), '?dryRun=true');

    expect(starts(res)).toEqual([instant(monday, '09:00')]);
    expect(res.body.data.totals).toEqual({ candidates: 2, slots: 1, skipped: 1 });
    expect(res.body.data.skipped).toEqual([
      {
        startAt: instant(monday, '10:30'),
        endAt: instant(monday, '11:30'),
        reason: 'OVERLAPS_EXISTING',
        clashingSlot: {
          id: existing.id,
          startAt: instant(monday, '10:00'),
          endAt: instant(monday, '11:00'),
          dealershipName: 'Prestige Mayfair',
        },
      },
    ]);
  });

  it('treats dryRun=false as a real run', async () => {
    const res = await post(body({ daysOfWeek: ['MON'] }), '?dryRun=false');

    expect(res.status).toBe(201);
    expect(await prisma.timeSlot.count()).toBe(2);
  });

  it('rejects an invalid dryRun value or unknown query parameter', async () => {
    expect((await post(body(), '?dryRun=maybe')).status).toBe(422);
    expect((await post(body(), '?preview=true')).status).toBe(422);
  });
});

describe('clashes and skipped slots', () => {
  it('skips slots that overlap existing ones and creates the rest', async () => {
    await addSlot(data, new Date(instant(monday, '10:00')));
    const res = await post(body({ daysOfWeek: ['MON'] }));

    expect(res.status).toBe(201);
    expect(starts(res)).toEqual([instant(monday, '09:00')]);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0]).toMatchObject({ reason: 'OVERLAPS_EXISTING' });
    expect(await prisma.timeSlot.count()).toBe(2);
  });

  it('detects clashes with slots of the same vehicle at another dealership', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(manchester.id, data.vehicle.id);
    await addSlot({ ...data, dealership: manchester }, new Date(instant(monday, '09:00')));
    const res = await post(body({ daysOfWeek: ['MON'] }));

    expect(res.body.data.skipped[0].clashingSlot.dealershipName).toBe('Prestige Deansgate');
  });

  it('ignores inactive slots and slots of other vehicles', async () => {
    const other = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, other.id);
    await addSlot(data, new Date(instant(monday, '09:00')), { isActive: false });
    await addSlot({ ...data, vehicle: other }, new Date(instant(monday, '10:30')));
    const res = await post(body({ daysOfWeek: ['MON'] }));

    expect(res.body.data.totals).toEqual({ candidates: 2, slots: 2, skipped: 0 });
  });

  it('skips slots that start in the past', async () => {
    const today = utcInstant(0, 0).toISOString().slice(0, 10);
    const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getUTCDay()];
    const res = await post(
      body({
        dateFrom: today,
        dateTo: today,
        daysOfWeek: [weekday],
        dailyStartTime: '00:00',
        dailyEndTime: '01:00',
        durationMinutes: 15,
        breakMinutes: 0,
      }),
      '?dryRun=true',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.skipped.every((s: { reason: string }) => s.reason === 'IN_PAST')).toBe(
      true,
    );
    expect(res.body.data.totals.candidates).toBe(4);
    expect(res.body.data.totals.slots + res.body.data.totals.skipped).toBe(4);
    if (new Date().getUTCHours() >= 1) expect(res.body.data.totals.slots).toBe(0);
  });

  it('is idempotent: running the same request twice creates the slots only once', async () => {
    await post(body());
    const second = await post(body());

    expect(second.status).toBe(201);
    expect(second.body.data.totals).toEqual({ candidates: 4, slots: 0, skipped: 4 });
    expect(await prisma.timeSlot.count()).toBe(4);
  });

  it('does not touch existing bookings', async () => {
    const existing = await addSlot(data, new Date(instant(monday, '10:00')));
    const booking = await createBooking(data.customer.id, existing.id, 'APPROVED');
    await post(body({ daysOfWeek: ['MON'] }));
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });

    expect(stored.status).toBe('APPROVED');
    expect(stored.slotId).toBe(existing.id);
  });

  it('CONCURRENCY: lets two simultaneous identical requests create each slot only once', async () => {
    const results = await Promise.all([post(body()), post(body()), post(body())]);

    expect(results.every(r => r.status === 201)).toBe(true);
    expect(results.reduce((sum, r) => sum + r.body.data.totals.slots, 0)).toBe(4);
    expect(await prisma.timeSlot.count()).toBe(4);
  });
});

describe('validation', () => {
  it.each([
    ['dateTo before dateFrom', { dateTo: shiftDate(upcomingWeekday(1), -3) }, 'dateTo'],
    ['a range over 92 days', { dateTo: shiftDate(upcomingWeekday(1), 93) }, 'dateTo'],
    ['an impossible date', { dateFrom: '2030-02-30' }, 'dateFrom'],
    ['a date in the wrong format', { dateFrom: '15/01/2030' }, 'dateFrom'],
    ['a time without leading zero', { dailyStartTime: '9:00' }, 'dailyStartTime'],
    ['an hour of 24', { dailyEndTime: '24:00' }, 'dailyEndTime'],
    ['an end time equal to the start', { dailyEndTime: '09:00' }, 'dailyEndTime'],
    ['an end time before the start', { dailyEndTime: '08:00' }, 'dailyEndTime'],
    ['no days of the week', { daysOfWeek: [] }, 'daysOfWeek'],
    ['a duplicated day', { daysOfWeek: ['MON', 'MON'] }, 'daysOfWeek'],
    ['an unknown day', { daysOfWeek: ['FUNDAY'] }, 'daysOfWeek.0'],
    ['a duration under 15 minutes', { durationMinutes: 10 }, 'durationMinutes'],
    ['a duration over 240 minutes', { durationMinutes: 241 }, 'durationMinutes'],
    ['a fractional duration', { durationMinutes: 45.5 }, 'durationMinutes'],
    ['a negative break', { breakMinutes: -5 }, 'breakMinutes'],
    ['an unknown time zone', { timeZone: 'Mars/Olympus' }, 'timeZone'],
    ['a malformed dealership id', { dealershipId: 'abc' }, 'dealershipId'],
    ['an unknown field', { isActive: false }, 'isActive'],
  ])('rejects %s', async (_label, overrides, field) => {
    const res = await post(body(overrides));

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toContain(field);
    expect(await prisma.timeSlot.count()).toBe(0);
  });

  it('accepts a range of exactly 92 days', async () => {
    const res = await post(
      body({
        dateTo: shiftDate(monday, 91),
        daysOfWeek: ['MON'],
        dailyEndTime: '10:00',
        breakMinutes: 0,
      }),
      '?dryRun=true',
    );

    expect(res.status).toBe(200);
  });

  it('refuses to generate more than 500 slots at once', async () => {
    const res = await post(
      body({
        dateTo: shiftDate(monday, 91),
        daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        dailyStartTime: '06:00',
        dailyEndTime: '22:00',
        durationMinutes: 15,
        breakMinutes: 0,
      }),
    );

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toContain('at most 500');
    expect(await prisma.timeSlot.count()).toBe(0);
  });

  it('applies the same checks to the preview', async () => {
    expect((await post(body({ daysOfWeek: [] }), '?dryRun=true')).status).toBe(422);
  });

  it('refuses a deactivated dealership or vehicle and a vehicle that is not offered there', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    const notOffered = await post(body({ dealershipId: manchester.id }));
    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { isActive: false },
    });
    const dealership = await post(body());
    await prisma.dealership.update({ where: { id: data.dealership.id }, data: { isActive: true } });
    await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: false } });
    const vehicle = await post(body());

    expect(notOffered.body.error.details[0].message).toBe(
      'This vehicle is not offered at this dealership',
    );
    expect(dealership.body.error.details[0].message).toBe('Dealership is deactivated');
    expect(vehicle.body.error.details[0].message).toBe('Vehicle is deactivated');
    expect(await prisma.timeSlot.count()).toBe(0);
  });

  it('refuses unknown dealerships and vehicles, also in the preview', async () => {
    const res = await post(
      body({
        dealershipId: '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11',
        vehicleId: '1bbe7e55-75e7-4355-b1e3-af30b7b9ee11',
      }),
      '?dryRun=true',
    );

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toEqual(['dealershipId', 'vehicleId']);
  });
});

describe('generated slots in the customer flow', () => {
  it('become available to customers', async () => {
    await post(
      body({
        dateFrom: shiftDate(upcomingWeekday(1, 2), 0),
        dateTo: shiftDate(upcomingWeekday(1, 2), 0),
        daysOfWeek: ['MON'],
      }),
    );
    const res = await request(app).get(
      `/api/vehicles/${data.vehicle.id}/slots?to=${encodeURIComponent(utcInstant(30, 0).toISOString())}&from=${encodeURIComponent(utcInstant(0, 0).toISOString())}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.dates).toHaveLength(1);
    expect(Object.values<unknown[]>(res.body.data.slotsByDate)[0]).toHaveLength(2);
  });
});

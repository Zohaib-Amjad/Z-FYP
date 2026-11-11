import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import {
  createBooking,
  createDealership,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';
import { addSlot, utcInstant } from './helpers/slots';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let manchester: { id: string };

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
  manchester = await createDealership('Prestige Deansgate', 'Manchester');
  await linkVehicle(manchester.id, data.vehicle.id);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const slots = (query = '', vehicleId = data.vehicle.id) =>
  request(app).get(`/api/vehicles/${vehicleId}/slots${query}`);
const allIds = (res: request.Response): string[] =>
  Object.values<{ id: string }[]>(res.body.data.slotsByDate).flatMap(day => day.map(s => s.id));

describe('GET /api/vehicles/:vehicleId/slots', () => {
  it('is public and returns slots grouped by date with the dealership', async () => {
    const first = await addSlot(data, utcInstant(2, 9));
    const second = await addSlot(data, utcInstant(2, 11));
    const third = await addSlot({ ...data, dealership: manchester }, utcInstant(4, 14));
    const res = await slots();

    expect(res.status).toBe(200);
    const dayOne = utcInstant(2, 0).toISOString().slice(0, 10);
    const dayTwo = utcInstant(4, 0).toISOString().slice(0, 10);
    expect(res.body.data.vehicleId).toBe(data.vehicle.id);
    expect(res.body.data.dates).toEqual([dayOne, dayTwo]);
    expect(res.body.data.slotsByDate[dayOne].map((s: { id: string }) => s.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(res.body.data.slotsByDate[dayTwo]).toEqual([
      {
        id: third.id,
        startAt: utcInstant(4, 14).toISOString(),
        endAt: utcInstant(4, 15).toISOString(),
        dealership: { id: manchester.id, name: 'Prestige Deansgate', city: 'Manchester' },
      },
    ]);
  });

  it('returns empty collections when nothing is available', async () => {
    const res = await slots();

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ dates: [], slotsByDate: {} });
  });

  it('defaults to the next 14 days', async () => {
    const inside = await addSlot(data, utcInstant(13, 10));
    await addSlot(data, utcInstant(15, 10));
    const res = await slots();

    expect(allIds(res)).toEqual([inside.id]);
    const { from, to } = res.body.data.range;
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(14 * 86_400_000);
  });

  it('honours from and to, including offsets', async () => {
    const early = await addSlot(data, utcInstant(3, 9));
    const late = await addSlot(data, utcInstant(20, 9));
    const from = utcInstant(18, 0).toISOString();
    const to = utcInstant(22, 0).toISOString();
    const res = await slots(`?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

    expect(allIds(res)).toEqual([late.id]);
    const withOffset = await slots(
      `?from=${encodeURIComponent(utcInstant(1, 5).toISOString().replace('Z', '+05:00').replace(/T\d\d/, 'T10'))}`,
    );
    expect(withOffset.status).toBe(200);
    expect(allIds(withOffset)).toContain(early.id);
  });

  it('defaults the end of the range to 14 days after a given start', async () => {
    await addSlot(data, utcInstant(30, 10));
    const outside = await addSlot(data, utcInstant(46, 10));
    const res = await slots(`?from=${encodeURIComponent(utcInstant(29, 0).toISOString())}`);

    expect(allIds(res)).toHaveLength(1);
    expect(allIds(res)).not.toContain(outside.id);
  });

  it('only returns slots that are genuinely bookable', async () => {
    const free = await addSlot(data, utcInstant(2, 9));
    const booked = await addSlot(data, utcInstant(2, 10));
    const approved = await addSlot(data, utcInstant(2, 11));
    const rescheduled = await addSlot(data, utcInstant(2, 12));
    const cancelled = await addSlot(data, utcInstant(2, 13));
    const rejected = await addSlot(data, utcInstant(2, 14));
    const inactive = await addSlot(data, utcInstant(2, 15), { isActive: false });
    await addSlot(data, utcInstant(-1, 9));
    await createBooking(data.customer.id, booked.id, 'PENDING');
    await createBooking(data.customer.id, approved.id, 'APPROVED');
    await createBooking(data.customer.id, rescheduled.id, 'RESCHEDULED');
    await createBooking(data.customer.id, cancelled.id, 'CANCELLED');
    await createBooking(data.customer.id, rejected.id, 'REJECTED');
    const res = await slots();

    expect(allIds(res).sort()).toEqual([free.id, cancelled.id, rejected.id].sort());
    expect(allIds(res)).not.toContain(inactive.id);
  });

  it('excludes a slot that has already started', async () => {
    const started = await addSlot(data, new Date(Date.now() - 5 * 60_000), {
      endAt: new Date(Date.now() + 55 * 60_000),
    });
    const res = await slots();

    expect(allIds(res)).not.toContain(started.id);
  });

  it('excludes slots of deactivated dealerships and of unavailable links', async () => {
    const mayfair = await addSlot(data, utcInstant(2, 9));
    const hidden = await addSlot({ ...data, dealership: manchester }, utcInstant(2, 11));
    await prisma.dealership.update({ where: { id: manchester.id }, data: { isActive: false } });
    expect(allIds(await slots())).toEqual([mayfair.id]);

    await prisma.dealership.update({ where: { id: manchester.id }, data: { isActive: true } });
    await prisma.dealershipVehicle.update({
      where: {
        dealershipId_vehicleId: { dealershipId: manchester.id, vehicleId: data.vehicle.id },
      },
      data: { isAvailable: false },
    });
    expect(allIds(await slots())).toEqual([mayfair.id]);
    expect(allIds(await slots())).not.toContain(hidden.id);
  });

  it('filters by dealership', async () => {
    await addSlot(data, utcInstant(2, 9));
    const other = await addSlot({ ...data, dealership: manchester }, utcInstant(3, 9));
    const res = await slots(`?dealershipId=${manchester.id}`);

    expect(allIds(res)).toEqual([other.id]);
  });

  it('only returns slots of the requested vehicle', async () => {
    const other = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, other.id);
    await addSlot({ ...data, vehicle: other }, utcInstant(2, 9));
    const mine = await addSlot(data, utcInstant(2, 9));

    expect(allIds(await slots())).toEqual([mine.id]);
  });

  describe('time zones', () => {
    it('groups by UTC date by default', async () => {
      await addSlot(data, utcInstant(2, 23, 30), { endAt: utcInstant(3, 0, 30) });
      const res = await slots();

      expect(res.body.data.timeZone).toBe('UTC');
      expect(res.body.data.dates).toEqual([utcInstant(2, 0).toISOString().slice(0, 10)]);
    });

    it('groups by the date in the requested time zone', async () => {
      await addSlot(data, utcInstant(2, 23, 30), { endAt: utcInstant(3, 0, 30) });
      const res = await slots('?timeZone=Asia/Karachi');

      expect(res.body.data.timeZone).toBe('Asia/Karachi');
      expect(res.body.data.dates).toEqual([utcInstant(3, 0).toISOString().slice(0, 10)]);
    });

    it('keeps the stored instants in UTC regardless of the time zone', async () => {
      const slot = await addSlot(data, utcInstant(2, 23, 30), { endAt: utcInstant(3, 0, 30) });
      const res = await slots('?timeZone=America/New_York');
      const [day] = Object.values<{ id: string; startAt: string }[]>(res.body.data.slotsByDate);

      expect(day[0]).toMatchObject({ id: slot.id, startAt: utcInstant(2, 23, 30).toISOString() });
    });

    it('rejects an unknown time zone', async () => {
      const res = await slots('?timeZone=Mars/Olympus');

      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('timeZone');
    });
  });

  describe('validation', () => {
    it('rejects a range whose end is not after its start', async () => {
      const at = encodeURIComponent(utcInstant(3, 0).toISOString());
      const res = await slots(`?from=${at}&to=${at}`);

      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('to');
    });

    it('allows a range of exactly 60 days and rejects anything longer', async () => {
      const from = utcInstant(1, 0);
      const to60 = new Date(from.getTime() + 60 * 86_400_000);
      const to61 = new Date(from.getTime() + 61 * 86_400_000);
      const query = (to: Date) =>
        `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;

      expect((await slots(query(to60))).status).toBe(200);
      const tooLong = await slots(query(to61));
      expect(tooLong.status).toBe(422);
      expect(tooLong.body.error.details[0].message).toContain('60 days');
    });

    it('rejects an end date more than 60 days away when no start is given', async () => {
      const res = await slots(`?to=${encodeURIComponent(utcInstant(90, 0).toISOString())}`);

      expect(res.status).toBe(422);
    });

    it.each([
      'from=tomorrow',
      'from=2030-01-01',
      'from=2030-01-01T10:00:00',
      'to=nonsense',
      'dealershipId=abc',
      'colour=red',
    ])('rejects %s', async query => {
      expect((await slots(`?${query}`)).status).toBe(422);
    });
  });

  describe('vehicle lookup', () => {
    it('returns 404 for an unknown vehicle', async () => {
      expect((await slots('', '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status).toBe(404);
    });

    it('returns 404 for a deactivated vehicle', async () => {
      await addSlot(data, utcInstant(2, 9));
      await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: false } });

      expect((await slots()).status).toBe(404);
    });

    it('returns 422 for a malformed vehicle id', async () => {
      expect((await slots('', 'not-a-uuid')).status).toBe(422);
    });
  });
});

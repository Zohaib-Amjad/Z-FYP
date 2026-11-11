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

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const ACTIVE = ['PENDING', 'APPROVED', 'RESCHEDULED'] as const;
const makeCustomers = (count: number) =>
  Promise.all(
    Array.from({ length: count }, (_, i) =>
      createCustomer(
        `customer${i}@example.test`,
        `Customer${i}`,
        'Tester',
        `+44 7700 9000${String(i).padStart(2, '0')}`,
      ),
    ),
  );
const book = (customer: { id: string; role: 'CUSTOMER' | 'STAFF' }, slotId: string) =>
  request(app).post('/api/bookings').set('Cookie', authCookie(customer)).send({ slotId });
const statuses = (results: request.Response[]): number[] => results.map(r => r.status);
const codes = (results: request.Response[]): string[] =>
  results.filter(r => r.status !== 201).map(r => r.body.error.code);
const activeFor = (slotId: string) =>
  prisma.booking.count({ where: { slotId, status: { in: [...ACTIVE] } } });

describe('CONCURRENCY: many customers, one slot', () => {
  it('lets exactly one of 10 parallel requests win; the other 9 get 409 SLOT_UNAVAILABLE', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const customers = await makeCustomers(10);
    const results = await Promise.all(customers.map(customer => book(customer, slot.id)));

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.filter(r => r.status === 409)).toHaveLength(9);
    expect(new Set(codes(results))).toEqual(new Set(['SLOT_UNAVAILABLE']));
    expect(statuses(results).every(status => status === 201 || status === 409)).toBe(true);

    expect(await activeFor(slot.id)).toBe(1);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.bookingStatusHistory.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
    const winner = results.find(r => r.status === 201)!;
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: winner.body.data.id } });
    expect(stored.customerId).toBe(winner.body.data.customer.id);
  });

  it('holds up over repeated rounds', async () => {
    const customers = await makeCustomers(10);
    for (let round = 0; round < 6; round += 1) {
      const slot = await addSlot(data, utcInstant(3 + round, 10));
      const results = await Promise.all(customers.map(customer => book(customer, slot.id)));

      expect(
        results.filter(r => r.status === 201),
        `round ${round}`,
      ).toHaveLength(1);
      expect(await activeFor(slot.id), `round ${round}`).toBe(1);
    }
  });

  it('gives each slot exactly one winner when many customers hit several slots at once', async () => {
    const slots = await Promise.all([9, 11, 13].map(hour => addSlot(data, utcInstant(3, hour))));
    const customers = await makeCustomers(8);
    const attempts = slots.flatMap(slot => customers.map(customer => ({ slot, customer })));
    const results = await Promise.all(
      attempts.map(({ slot, customer }) => book(customer, slot.id)),
    );

    expect(results.filter(r => r.status === 201)).toHaveLength(3);
    for (const slot of slots) expect(await activeFor(slot.id)).toBe(1);
    expect(new Set(codes(results))).toEqual(
      new Set(
        ['SLOT_UNAVAILABLE', 'BOOKING_CONFLICT', 'ACTIVE_BOOKING_LIMIT'].filter(c =>
          codes(results).includes(c),
        ),
      ),
    );
    expect(statuses(results).every(status => status === 201 || status === 409)).toBe(true);
  });
});

describe('CONCURRENCY: one customer, several simultaneous requests', () => {
  it('lets only one of 2 identical parallel requests succeed (double-click)', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const results = await Promise.all([book(data.customer, slot.id), book(data.customer, slot.id)]);

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(codes(results)).toEqual(['SLOT_UNAVAILABLE']);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.bookingStatusHistory.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('lets only one of 6 rapid repeated clicks succeed', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const results = await Promise.all(
      Array.from({ length: 6 }, () => book(data.customer, slot.id)),
    );

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(await prisma.booking.count()).toBe(1);
  });

  it('lets only one of two overlapping slots of different vehicles be booked in parallel', async () => {
    const other = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, other.id);
    const first = await addSlot(data, utcInstant(3, 10));
    const second = await addSlot({ ...data, vehicle: other }, utcInstant(3, 10, 30));
    const results = await Promise.all([
      book(data.customer, first.id),
      book(data.customer, second.id),
    ]);

    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(codes(results)).toEqual(['BOOKING_CONFLICT']);
    expect(await prisma.booking.count()).toBe(1);
  });

  it('refuses the second of two overlapping slots when booked one after the other', async () => {
    const other = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, other.id);
    const first = await addSlot(data, utcInstant(3, 10));
    const second = await addSlot({ ...data, vehicle: other }, utcInstant(3, 10, 30));

    expect((await book(data.customer, first.id)).status).toBe(201);
    const res = await book(data.customer, second.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_CONFLICT');
  });

  it('never lets 6 parallel requests for different free slots exceed the limit of 3', async () => {
    const slots = await Promise.all(
      [8, 10, 12, 14, 16, 18].map(hour => addSlot(data, utcInstant(3, hour))),
    );
    const results = await Promise.all(slots.map(slot => book(data.customer, slot.id)));

    expect(results.filter(r => r.status === 201)).toHaveLength(3);
    expect(new Set(codes(results))).toEqual(new Set(['ACTIVE_BOOKING_LIMIT']));
    expect(
      await prisma.booking.count({
        where: { customerId: data.customer.id, status: { in: [...ACTIVE] } },
      }),
    ).toBe(3);
  });

  it('honours the limit across repeated bursts', async () => {
    for (let round = 0; round < 4; round += 1) {
      await prisma.booking.deleteMany();
      await prisma.timeSlot.deleteMany();
      const slots = await Promise.all(
        [8, 10, 12, 14, 16].map(hour => addSlot(data, utcInstant(3 + round, hour))),
      );
      const results = await Promise.all(slots.map(slot => book(data.customer, slot.id)));

      expect(
        results.filter(r => r.status === 201),
        `round ${round}`,
      ).toHaveLength(3);
    }
  });
});

describe('CONCURRENCY: booking racing with deactivation', () => {
  const settle = async <T>(promises: Promise<T>[]): Promise<T[]> => Promise.all(promises);

  it('never leaves an active booking on a deactivated slot', async () => {
    const staff = { id: data.staff.id, role: 'STAFF' as const };
    for (let round = 0; round < 8; round += 1) {
      const slot = await addSlot(data, utcInstant(3 + round, 10));
      const customer = (await makeCustomersOnce(round))[0];
      const [bookingResult, deactivation] = await settle([
        book(customer, slot.id),
        request(app)
          .patch(`/api/admin/slots/${slot.id}/deactivate`)
          .set('Cookie', authCookie(staff)),
      ]);
      const stored = await prisma.timeSlot.findUniqueOrThrow({ where: { id: slot.id } });
      const active = await activeFor(slot.id);

      expect(!(active > 0 && !stored.isActive), `round ${round}`).toBe(true);
      expect(bookingResult.status === 201 ? deactivation.status === 409 : true).toBe(true);
      if (deactivation.status === 200) expect(bookingResult.status).toBe(409);
    }
  });

  it('never leaves an active booking for a vehicle that was deactivated', async () => {
    const staff = { id: data.staff.id, role: 'STAFF' as const };
    for (let round = 0; round < 6; round += 1) {
      await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: true } });
      await prisma.booking.deleteMany();
      const slot = await addSlot(data, utcInstant(20 + round, 10));
      const customer = (await makeCustomersOnce(100 + round))[0];
      const [bookingResult, deactivation] = await settle([
        book(customer, slot.id),
        request(app)
          .patch(`/api/admin/vehicles/${data.vehicle.id}/deactivate`)
          .set('Cookie', authCookie(staff)),
      ]);
      const stored = await prisma.vehicle.findUniqueOrThrow({ where: { id: data.vehicle.id } });
      const futureActive = await prisma.booking.count({
        where: {
          status: { in: [...ACTIVE] },
          slot: { vehicleId: data.vehicle.id, startAt: { gt: new Date() } },
        },
      });

      expect(!(futureActive > 0 && !stored.isActive), `round ${round}`).toBe(true);
      expect([bookingResult.status, deactivation.status].sort()).toSatisfy(
        (pair: number[]) =>
          (pair[0] === 200 && pair[1] === 201) ||
          (pair[0] === 200 && pair[1] === 409) ||
          (pair[0] === 201 && pair[1] === 409),
      );
    }
  });

  it('never leaves an active booking at a dealership that was deactivated', async () => {
    const staff = { id: data.staff.id, role: 'STAFF' as const };
    for (let round = 0; round < 6; round += 1) {
      const dealership = await createDealership(`Prestige Round ${round}`, `City ${round}`);
      await linkVehicle(dealership.id, data.vehicle.id);
      const slot = await addSlot({ ...data, dealership }, utcInstant(40 + round, 10));
      const customer = (await makeCustomersOnce(200 + round))[0];
      await settle([
        book(customer, slot.id),
        request(app)
          .patch(`/api/admin/dealerships/${dealership.id}/deactivate`)
          .set('Cookie', authCookie(staff)),
      ]);
      const stored = await prisma.dealership.findUniqueOrThrow({ where: { id: dealership.id } });
      const active = await activeFor(slot.id);

      expect(!(active > 0 && !stored.isActive), `round ${round}`).toBe(true);
    }
  });

  it('never creates a booking for a customer who was deactivated at the same moment', async () => {
    const staff = { id: data.staff.id, role: 'STAFF' as const };
    for (let round = 0; round < 6; round += 1) {
      const [customer] = await makeCustomersOnce(300 + round);
      const slot = await addSlot(data, utcInstant(60 + round, 10));
      await settle([
        book(customer, slot.id),
        request(app)
          .patch(`/api/admin/customers/${customer.id}/status`)
          .set('Cookie', authCookie(staff))
          .send({ isActive: false }),
      ]);
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
      const active = await prisma.booking.count({
        where: { customerId: customer.id, status: { in: [...ACTIVE] } },
      });

      expect(stored.isActive).toBe(false);
      expect(active, `round ${round}`).toBe(0);
    }
  });
});

const makeCustomersOnce = async (seed: number) => [
  await createCustomer(`racer${seed}@example.test`, 'Racer', `Number${seed}`, '+44 7700 900999'),
];

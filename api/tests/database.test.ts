import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { resetDatabase, seedMinimalData } from './helpers/db';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

describe('test database', () => {
  it('is separate from the development database', () => {
    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBe(process.env.DATABASE_URL_TEST);
    expect(env.DATABASE_URL.endsWith('/testdrive')).toBe(false);
  });

  it('is reset between tests', async () => {
    await seedMinimalData();
    expect(await prisma.user.count()).toBe(2);

    await resetDatabase();
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.timeSlot.count()).toBe(0);
  });

  it('seeds a consistent minimal data set', async () => {
    const { slot, dealership, vehicle } = await seedMinimalData();

    expect(slot.dealershipId).toBe(dealership.id);
    expect(slot.vehicleId).toBe(vehicle.id);
    expect(slot.endAt.getTime()).toBeGreaterThan(slot.startAt.getTime());
  });

  it('has the scheduling constraints from the custom migration', async () => {
    const { slot, staff } = await seedMinimalData();
    const overlapping = prisma.timeSlot.create({
      data: {
        dealershipId: slot.dealershipId,
        vehicleId: slot.vehicleId,
        startAt: new Date(slot.startAt.getTime() + 30 * 60_000),
        endAt: new Date(slot.endAt.getTime() + 30 * 60_000),
        createdById: staff.id,
      },
    });

    await expect(overlapping).rejects.toThrow(/time_slots_no_vehicle_overlap/);
  });
});

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import { createBookingAt, resetDatabase, seedMinimalData } from './helpers/db';
import { addSlot, utcInstant } from './helpers/slots';

const app = createApp();
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let customerCookie: string;

beforeEach(async () => {
  await resetDatabase();
  data = await seedMinimalData();
  customerCookie = authCookie(data.customer);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const preview = (id: string, cookie: string | undefined = customerCookie) => {
  const req = request(app).get(`/api/bookings/slots/${id}`);
  return cookie ? req.set('Cookie', cookie) : req;
};
const target = () => ({ staff: data.staff, vehicle: data.vehicle, dealership: data.dealership });

describe('GET /api/bookings/slots/:id', () => {
  it('describes a bookable slot with its vehicle, dealership and policy', async () => {
    const slot = await addSlot(target(), utcInstant(6, 10));

    const res = await preview(slot.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: slot.id,
      isAvailable: true,
      cancellationWindowHours: env.CANCELLATION_WINDOW_HOURS,
      dealership: { id: data.dealership.id, name: data.dealership.name },
      vehicle: { id: data.vehicle.id, manufacturer: data.vehicle.manufacturer },
    });
    expect(
      new Date(res.body.data.endAt).getTime() - new Date(res.body.data.startAt).getTime(),
    ).toBe(3_600_000);
    expect(res.body.data.vehicle).toHaveProperty('primaryImage');
    expect(res.body.data.dealership).toHaveProperty('openingHours');
  });

  it('reports a slot that has been booked as unavailable instead of failing', async () => {
    const booking = await createBookingAt({
      customerId: data.customer.id,
      target: target(),
      status: 'PENDING',
      slotStart: utcInstant(6, 11),
    });
    const bookedSlot = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { slotId: true },
    });

    const res = await preview(bookedSlot.slotId);

    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);
  });

  it('reports a slot that has already started as unavailable', async () => {
    const slot = await addSlot(target(), utcInstant(-1, 10));

    expect((await preview(slot.id)).body.data.isAvailable).toBe(false);
  });

  it('hides deactivated slots, vehicles and dealerships (A6)', async () => {
    const inactiveSlot = await addSlot(target(), utcInstant(6, 12), { isActive: false });
    expect((await preview(inactiveSlot.id)).status).toBe(404);

    const slot = await addSlot(target(), utcInstant(6, 13));
    await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: false } });
    expect((await preview(slot.id)).status).toBe(404);
    await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: true } });

    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { isActive: false },
    });
    expect((await preview(slot.id)).status).toBe(404);
  });

  it('returns 404 for an unknown slot and 422 for a malformed id', async () => {
    const missing = await preview('00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const malformed = await preview('not-a-uuid');
    expect(malformed.status).toBe(422);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is for signed-in customers only', async () => {
    const slot = await addSlot(target(), utcInstant(6, 14));

    expect((await preview(slot.id, '')).status).toBe(401);
    expect((await preview(slot.id, authCookie(data.staff))).status).toBe(403);
  });
});

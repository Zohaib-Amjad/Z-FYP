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

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  staffCookie = authCookie(data.staff);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const put = (body: unknown, vehicleId = data.vehicle.id) =>
  request(app)
    .put(`/api/admin/vehicles/${vehicleId}/dealerships`)
    .set('Cookie', staffCookie)
    .send(body as object);
const linksOf = (vehicleId = data.vehicle.id) =>
  prisma.dealershipVehicle.findMany({ where: { vehicleId }, orderBy: { dealershipId: 'asc' } });

describe('PUT /api/admin/vehicles/:id/dealerships', () => {
  it('is restricted to staff', async () => {
    const asCustomer = await request(app)
      .put(`/api/admin/vehicles/${data.vehicle.id}/dealerships`)
      .set('Cookie', authCookie(data.customer))
      .send({ dealerships: [] });
    const anonymous = await request(app)
      .put(`/api/admin/vehicles/${data.vehicle.id}/dealerships`)
      .send({ dealerships: [] });

    expect(asCustomer.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });

  it('adds dealerships and sets their availability', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    const edinburgh = await createDealership('Prestige Edinburgh', 'Edinburgh');
    const res = await put({
      dealerships: [
        { dealershipId: data.dealership.id, isAvailable: true },
        { dealershipId: manchester.id, isAvailable: true },
        { dealershipId: edinburgh.id, isAvailable: false },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      [
        {
          id: manchester.id,
          name: 'Prestige Deansgate',
          city: 'Manchester',
          isActive: true,
          isAvailable: true,
        },
        {
          id: edinburgh.id,
          name: 'Prestige Edinburgh',
          city: 'Edinburgh',
          isActive: true,
          isAvailable: false,
        },
        {
          id: data.dealership.id,
          name: 'Prestige Mayfair',
          city: 'London',
          isActive: true,
          isAvailable: true,
        },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
  });

  it('removes a dealership that has no slots', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(manchester.id, data.vehicle.id);
    const res = await put({
      dealerships: [{ dealershipId: data.dealership.id, isAvailable: true }],
    });

    expect(res.status).toBe(200);
    expect((await linksOf()).map(l => l.dealershipId)).toEqual([data.dealership.id]);
  });

  it('keeps the link as unavailable when removal would erase slot history', async () => {
    const past = await createSlot(data, -4, 10);
    await prisma.timeSlot.update({ where: { id: data.slot.id }, data: { isActive: false } });
    const booking = await createBooking(data.customer.id, past.id, 'COMPLETED');
    const res = await put({ dealerships: [] });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: data.dealership.id, isAvailable: false }),
    ]);
    expect(await prisma.booking.count({ where: { id: booking.id } })).toBe(1);
    expect(await prisma.timeSlot.count({ where: { vehicleId: data.vehicle.id } })).toBe(2);
  });

  it('is blocked by future active bookings with details per dealership', async () => {
    await createBooking(data.customer.id, data.slot.id, 'APPROVED');
    const res = await put({ dealerships: [] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_ACTIVE_BOOKINGS');
    expect(res.body.error.details).toEqual([
      {
        field: `dealerships.${data.dealership.id}`,
        message: 'Prestige Mayfair: 1 upcoming active booking, 1 active upcoming slot',
      },
    ]);
    expect((await linksOf()).map(l => [l.dealershipId, l.isAvailable])).toEqual([
      [data.dealership.id, true],
    ]);
  });

  it('is blocked by active upcoming slots even without bookings', async () => {
    const res = await put({ dealerships: [] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details[0].message).toContain(
      '0 upcoming active bookings, 1 active upcoming slot',
    );
  });

  it('treats marking a dealership unavailable the same as removing it', async () => {
    const res = await put({
      dealerships: [{ dealershipId: data.dealership.id, isAvailable: false }],
    });

    expect(res.status).toBe(409);
    expect((await linksOf())[0].isAvailable).toBe(true);
  });

  it('allows withdrawal once the slots are deactivated', async () => {
    await prisma.timeSlot.update({ where: { id: data.slot.id }, data: { isActive: false } });
    const res = await put({
      dealerships: [{ dealershipId: data.dealership.id, isAvailable: false }],
    });

    expect(res.status).toBe(200);
    expect(res.body.data[0].isAvailable).toBe(false);
  });

  it('does not count past slots or other dealerships and vehicles', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(manchester.id, data.vehicle.id);
    const elsewhere = await createSlot({ ...data, dealership: manchester }, 8, 10);
    await createBooking(data.customer.id, elsewhere.id, 'PENDING');
    const res = await put({
      dealerships: [
        { dealershipId: data.dealership.id, isAvailable: true },
        { dealershipId: manchester.id, isAvailable: true },
      ],
    });

    expect(res.status).toBe(200);
  });

  it('applies nothing when any withdrawal is blocked', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    const edinburgh = await createDealership('Prestige Edinburgh', 'Edinburgh');
    const res = await put({
      dealerships: [
        { dealershipId: edinburgh.id, isAvailable: true },
        { dealershipId: manchester.id, isAvailable: true },
      ],
    });

    expect(res.status).toBe(409);
    expect((await linksOf()).map(l => l.dealershipId)).toEqual([data.dealership.id]);
  });

  it('rejects unknown and deactivated dealerships, naming the offending entry', async () => {
    const inactive = await createDealership('Prestige Deansgate', 'Manchester', {
      isActive: false,
    });
    const res = await put({
      dealerships: [
        { dealershipId: data.dealership.id, isAvailable: true },
        { dealershipId: '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', isAvailable: true },
        { dealershipId: inactive.id, isAvailable: true },
      ],
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      { field: 'dealerships.1.dealershipId', message: 'Dealership not found' },
      { field: 'dealerships.2.dealershipId', message: 'Dealership is deactivated' },
    ]);
  });

  it('keeps an existing link to a dealership that has since been deactivated', async () => {
    await prisma.timeSlot.update({ where: { id: data.slot.id }, data: { isActive: false } });
    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { isActive: false },
    });
    const res = await put({
      dealerships: [{ dealershipId: data.dealership.id, isAvailable: true }],
    });

    expect(res.status).toBe(200);
  });

  it('validates the body', async () => {
    const duplicated = await put({
      dealerships: [
        { dealershipId: data.dealership.id, isAvailable: true },
        { dealershipId: data.dealership.id, isAvailable: false },
      ],
    });
    const malformed = await put({ dealerships: [{ dealershipId: 'abc', isAvailable: 'yes' }] });
    const missing = await put({});
    const extra = await put({ dealerships: [], role: 'x' });

    expect([duplicated.status, malformed.status, missing.status, extra.status]).toEqual([
      422, 422, 422, 422,
    ]);
  });

  it('returns 404 for an unknown vehicle', async () => {
    const res = await put({ dealerships: [] }, '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11');

    expect(res.status).toBe(404);
  });

  it('changes what customers see for the dealership filter', async () => {
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await put({
      dealerships: [
        { dealershipId: data.dealership.id, isAvailable: true },
        { dealershipId: manchester.id, isAvailable: true },
      ],
    });
    const res = await request(app).get(`/api/dealerships?vehicleId=${data.vehicle.id}`);

    expect(res.body.data.map((d: { id: string }) => d.id).sort()).toEqual(
      [data.dealership.id, manchester.id].sort(),
    );
  });
});

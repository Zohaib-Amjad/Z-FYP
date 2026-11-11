import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import {
  TEST_PASSWORD,
  createBooking,
  createCustomer,
  createSlot,
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

const get = (url: string) => request(app).get(url).set('Cookie', staffCookie);
const setStatus = (id: string, body: unknown) =>
  request(app)
    .patch(`/api/admin/customers/${id}/status`)
    .set('Cookie', staffCookie)
    .send(body as object);

describe('GET /api/admin/customers', () => {
  it('lists customers only, never staff, with booking stats and no password hash', async () => {
    await createBooking(data.customer.id, data.slot.id, 'PENDING');
    const res = await get('/api/admin/customers');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
    const [item] = res.body.data.items;
    expect(item).toMatchObject({
      id: data.customer.id,
      email: 'customer@example.test',
      role: 'CUSTOMER',
      bookingCount: 1,
    });
    expect(typeof item.lastBookingAt).toBe('string');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('staff@example.test');
  });

  it('reports zero bookings and a null last booking for a customer without any', async () => {
    const res = await get('/api/admin/customers');

    expect(res.body.data.items[0]).toMatchObject({ bookingCount: 0, lastBookingAt: null });
  });

  describe('with several customers', () => {
    beforeEach(async () => {
      const isabella = await createCustomer(
        'isabella.rossi@example.test',
        'Isabella',
        'Rossi',
        '+44 7700 900555',
      );
      const henry = await createCustomer(
        'henry.caldwell@example.test',
        'Henry',
        'Caldwell',
        '+44 7700 900666',
      );
      await prisma.user.update({ where: { id: henry.id }, data: { isActive: false } });
      const second = await createSlot(data, 5, 10);
      const third = await createSlot(data, 5, 12);
      await createBooking(isabella.id, second.id);
      await createBooking(isabella.id, third.id, 'CANCELLED');
      await createBooking(data.customer.id, data.slot.id);
    });

    it.each([
      ['first name', 'isabella', 'isabella.rossi@example.test'],
      ['last name, upper case', 'CALDWELL', 'henry.caldwell@example.test'],
      ['email fragment', 'customer@', 'customer@example.test'],
      ['phone fragment', '900555', 'isabella.rossi@example.test'],
    ])('searches by %s', async (_label, q, expectedEmail) => {
      const res = await get(`/api/admin/customers?q=${encodeURIComponent(q)}`);

      expect(res.body.data.items.map((i: { email: string }) => i.email)).toEqual([expectedEmail]);
    });

    it('matches several search words together', async () => {
      const both = await get('/api/admin/customers?q=isabella%20rossi');
      const mismatch = await get('/api/admin/customers?q=isabella%20caldwell');

      expect(both.body.data.total).toBe(1);
      expect(mismatch.body.data.total).toBe(0);
    });

    it('filters by active status', async () => {
      const inactive = await get('/api/admin/customers?isActive=false');
      const active = await get('/api/admin/customers?isActive=true');

      expect(inactive.body.data.items.map((i: { email: string }) => i.email)).toEqual([
        'henry.caldwell@example.test',
      ]);
      expect(active.body.data.total).toBe(2);
    });

    it('paginates', async () => {
      const first = await get('/api/admin/customers?pageSize=2&page=1&sortBy=email&sortOrder=asc');
      const second = await get('/api/admin/customers?pageSize=2&page=2&sortBy=email&sortOrder=asc');

      expect(first.body.data).toMatchObject({ total: 3, totalPages: 2, pageSize: 2 });
      expect(first.body.data.items).toHaveLength(2);
      expect(second.body.data.items).toHaveLength(1);
    });

    it('sorts by last name and by booking count', async () => {
      const byName = await get('/api/admin/customers?sortBy=lastName&sortOrder=asc');
      const byCount = await get('/api/admin/customers?sortBy=bookingCount&sortOrder=desc');

      expect(byName.body.data.items.map((i: { lastName: string }) => i.lastName)).toEqual([
        'Caldwell',
        'Hart',
        'Rossi',
      ]);
      expect(byCount.body.data.items[0]).toMatchObject({ lastName: 'Rossi', bookingCount: 2 });
    });

    it('counts bookings of every status', async () => {
      const res = await get('/api/admin/customers?q=rossi');

      expect(res.body.data.items[0].bookingCount).toBe(2);
    });
  });

  it('rejects invalid query parameters with 422', async () => {
    const badSort = await get('/api/admin/customers?sortBy=passwordHash');
    const badSize = await get('/api/admin/customers?pageSize=51');
    const badActive = await get('/api/admin/customers?isActive=maybe');

    expect([badSort.status, badSize.status, badActive.status]).toEqual([422, 422, 422]);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/admin/customers')).status).toBe(401);
  });
});

describe('GET /api/admin/customers/:id', () => {
  it('returns the profile with a bookings summary', async () => {
    const later = await createSlot(data, 6, 10);
    await createBooking(data.customer.id, data.slot.id, 'APPROVED');
    await createBooking(data.customer.id, later.id, 'CANCELLED');
    const res = await get(`/api/admin/customers/${data.customer.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customer).toMatchObject({ id: data.customer.id, role: 'CUSTOMER' });
    expect(res.body.data.customer).not.toHaveProperty('passwordHash');
    expect(res.body.data.summary).toEqual({ total: 2, byStatus: { APPROVED: 1, CANCELLED: 1 } });
    expect(res.body.data.bookings).toHaveLength(2);
    expect(res.body.data.bookings[0]).toMatchObject({
      slot: {
        vehicle: { manufacturer: 'Porsche', model: '911 Carrera T' },
        dealership: { name: 'Prestige Mayfair' },
      },
    });
  });

  it('returns an empty summary for a customer without bookings', async () => {
    const res = await get(`/api/admin/customers/${data.customer.id}`);

    expect(res.body.data.summary).toEqual({ total: 0, byStatus: {} });
    expect(res.body.data.bookings).toEqual([]);
  });

  it('returns 404 for unknown ids and for staff accounts', async () => {
    const unknown = await get('/api/admin/customers/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11');
    const staff = await get(`/api/admin/customers/${data.staff.id}`);

    expect(unknown.status).toBe(404);
    expect(staff.status).toBe(404);
  });

  it('returns 422 for a malformed id', async () => {
    expect((await get('/api/admin/customers/not-a-uuid')).status).toBe(422);
  });
});

describe('PATCH /api/admin/customers/:id/status', () => {
  it('deactivates a customer and cancels their future active bookings with history and notifications', async () => {
    const approvedSlot = await createSlot(data, 4, 10);
    const rescheduledSlot = await createSlot(data, 4, 12);
    const pending = await createBooking(data.customer.id, data.slot.id, 'PENDING');
    const approved = await createBooking(data.customer.id, approvedSlot.id, 'APPROVED');
    const rescheduled = await createBooking(data.customer.id, rescheduledSlot.id, 'RESCHEDULED');

    const res = await setStatus(data.customer.id, { isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.customer.isActive).toBe(false);
    expect(res.body.data.cancelledBookings).toBe(3);

    for (const [booking, from] of [
      [pending, 'PENDING'],
      [approved, 'APPROVED'],
      [rescheduled, 'RESCHEDULED'],
    ] as const) {
      const stored = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { statusHistory: true, notifications: true },
      });
      expect(stored.status).toBe('CANCELLED');
      expect(stored.cancellationReason).toBe('Account deactivated');
      expect(stored.cancelledBy).toBe('STAFF');
      expect(stored.statusHistory).toHaveLength(1);
      expect(stored.statusHistory[0]).toMatchObject({
        fromStatus: from,
        toStatus: 'CANCELLED',
        action: 'CANCELLED',
        note: 'Account deactivated',
        changedById: data.staff.id,
      });
      expect(stored.notifications).toHaveLength(1);
      expect(stored.notifications[0]).toMatchObject({
        userId: data.customer.id,
        type: 'BOOKING_CANCELLED',
        isRead: false,
      });
      expect(stored.notifications[0].message).toContain('Account deactivated');
    }
  });

  it('leaves past and already-final bookings untouched', async () => {
    const pastSlot = await createSlot(data, -3, 10);
    const completedSlot = await createSlot(data, -5, 10);
    const rejectedSlot = await createSlot(data, 7, 10);
    const pastApproved = await createBooking(data.customer.id, pastSlot.id, 'APPROVED');
    const completed = await createBooking(data.customer.id, completedSlot.id, 'COMPLETED');
    const rejected = await createBooking(data.customer.id, rejectedSlot.id, 'REJECTED');

    const res = await setStatus(data.customer.id, { isActive: false });

    expect(res.body.data.cancelledBookings).toBe(0);
    const statuses = await prisma.booking.findMany({
      where: { id: { in: [pastApproved.id, completed.id, rejected.id] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(statuses.map(b => b.status)).toEqual(['APPROVED', 'COMPLETED', 'REJECTED']);
    expect(await prisma.bookingStatusHistory.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('does not touch the bookings of other customers', async () => {
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const otherSlot = await createSlot(data, 8, 10);
    const otherBooking = await createBooking(other.id, otherSlot.id, 'APPROVED');
    await createBooking(data.customer.id, data.slot.id, 'PENDING');

    await setStatus(data.customer.id, { isActive: false });

    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: otherBooking.id } });
    expect(stored.status).toBe('APPROVED');
  });

  it('frees the cancelled slots for other customers', async () => {
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    await createBooking(data.customer.id, data.slot.id, 'APPROVED');
    await setStatus(data.customer.id, { isActive: false });

    await expect(createBooking(other.id, data.slot.id, 'PENDING')).resolves.toBeDefined();
  });

  it('blocks the deactivated customer from logging in and from using an existing cookie', async () => {
    const existingCookie = authCookie(data.customer);
    await setStatus(data.customer.id, { isActive: false });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.test', password: TEST_PASSWORD });
    const me = await request(app).get('/api/auth/me').set('Cookie', existingCookie);
    const profile = await request(app).get('/api/profile').set('Cookie', existingCookie);

    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');
    expect(me.status).toBe(403);
    expect(profile.status).toBe(403);
  });

  it('reactivates a customer without restoring cancelled bookings', async () => {
    const booking = await createBooking(data.customer.id, data.slot.id, 'PENDING');
    await setStatus(data.customer.id, { isActive: false });
    const res = await setStatus(data.customer.id, { isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.data.customer.isActive).toBe(true);
    expect(res.body.data.cancelledBookings).toBe(0);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.test', password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.status).toBe('CANCELLED');
  });

  it('is idempotent when the status does not change', async () => {
    await createBooking(data.customer.id, data.slot.id, 'PENDING');
    await setStatus(data.customer.id, { isActive: false });
    const again = await setStatus(data.customer.id, { isActive: false });

    expect(again.status).toBe(200);
    expect(again.body.data.cancelledBookings).toBe(0);
    expect(await prisma.bookingStatusHistory.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('returns 404 for staff accounts and unknown ids', async () => {
    const staff = await setStatus(data.staff.id, { isActive: false });
    const unknown = await setStatus('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', { isActive: false });

    expect(staff.status).toBe(404);
    expect(unknown.status).toBe(404);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: data.staff.id } });
    expect(stored.isActive).toBe(true);
  });

  it('validates the body', async () => {
    const missing = await setStatus(data.customer.id, {});
    const wrongType = await setStatus(data.customer.id, { isActive: 'false' });
    const extra = await setStatus(data.customer.id, { isActive: false, role: 'STAFF' });

    expect([missing.status, wrongType.status, extra.status]).toEqual([422, 422, 422]);
  });

  it('does not allow customers to be hard deleted', async () => {
    const res = await request(app)
      .delete(`/api/admin/customers/${data.customer.id}`)
      .set('Cookie', staffCookie);

    expect(res.status).toBe(404);
    expect(await prisma.user.count({ where: { id: data.customer.id } })).toBe(1);
  });
});

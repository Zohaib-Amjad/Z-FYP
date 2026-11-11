import type { BookingStatus } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import * as mailService from '../src/services/mailService';
import * as notificationService from '../src/services/notificationService';
import { authCookie } from './helpers/auth';
import {
  createBooking,
  createCustomer,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';
import { addSlot, utcInstant } from './helpers/slots';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let customerCookie: string;
let staffCookie: string;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
  customerCookie = authCookie(data.customer);
  staffCookie = authCookie(data.staff);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const HOUR = 3_600_000;
const code = (res: request.Response): string => res.body.error.code;
const get = (url: string, cookie = customerCookie) => request(app).get(url).set('Cookie', cookie);
const cancel = (id: string, body: object = {}, cookie = customerCookie) =>
  request(app).patch(`/api/bookings/${id}/cancel`).set('Cookie', cookie).send(body);
const staffAct = (id: string, action: string, body: object = {}) =>
  request(app).patch(`/api/admin/bookings/${id}/${action}`).set('Cookie', staffCookie).send(body);
const stored = (id: string) =>
  prisma.booking.findUniqueOrThrow({
    where: { id },
    include: { statusHistory: true, notifications: true },
  });

const secondVehicle = async () => {
  const vehicle = await createVehicle({ model: `Spare ${Math.random().toString(36).slice(2, 8)}` });
  await linkVehicle(data.dealership.id, vehicle.id);
  return { ...data, vehicle };
};

const bookingAtHours = async (
  status: BookingStatus,
  hoursFromNow: number,
  customerId = data.customer.id,
) => {
  const target = await secondVehicle();
  const startAt = new Date(Date.now() + hoursFromNow * HOUR);
  const slot = await addSlot(target, startAt, { endAt: new Date(startAt.getTime() + 15 * 60_000) });
  return createBooking(customerId, slot.id, status);
};

interface Fixture {
  [name: string]: { id: string; startAt: Date };
}

const fixtureSpec: [string, BookingStatus, number][] = [
  ['pendingFuture', 'PENDING', 3],
  ['approvedFuture', 'APPROVED', 4],
  ['rescheduledFuture', 'RESCHEDULED', 5],
  ['cancelledFuture', 'CANCELLED', 6],
  ['rejectedFuture', 'REJECTED', 7],
  ['completedPast', 'COMPLETED', -5],
  ['approvedPast', 'APPROVED', -2],
  ['pendingPast', 'PENDING', -3],
  ['cancelledPast', 'CANCELLED', -8],
];

const buildFixture = async (): Promise<Fixture> => {
  const fixture: Fixture = {};
  for (const [name, status, days] of fixtureSpec) {
    const slot = await addSlot(data, utcInstant(days, 10));
    const booking = await createBooking(data.customer.id, slot.id, status);
    fixture[name] = { id: booking.id, startAt: slot.startAt };
  }
  const other = await createCustomer(
    'isabella.rossi@example.test',
    'Isabella',
    'Rossi',
    '+44 7700 900555',
  );
  for (const [status, days] of [
    ['PENDING', 9],
    ['COMPLETED', -9],
  ] as [BookingStatus, number][]) {
    const slot = await addSlot(data, utcInstant(days, 10));
    await createBooking(other.id, slot.id, status);
  }
  return fixture;
};

const EXPECTED_VIEWS: Record<string, string[]> = {
  pending: ['pendingPast', 'pendingFuture'],
  upcoming: ['approvedFuture', 'rescheduledFuture'],
  completed: ['completedPast'],
  cancelled: ['rejectedFuture', 'cancelledFuture', 'cancelledPast'],
  previous: ['approvedPast', 'pendingPast', 'completedPast', 'cancelledPast'],
  all: [
    'rejectedFuture',
    'cancelledFuture',
    'rescheduledFuture',
    'approvedFuture',
    'pendingFuture',
    'approvedPast',
    'pendingPast',
    'completedPast',
    'cancelledPast',
  ],
};

describe('GET /api/bookings/mine: views (A9)', () => {
  let fixture: Fixture;
  const idsOf = (res: request.Response): string[] =>
    res.body.data.items.map((i: { id: string }) => i.id);
  const names = (res: request.Response): string[] => {
    const byId = new Map(Object.entries(fixture).map(([name, value]) => [value.id, name]));
    return idsOf(res).map(id => byId.get(id) ?? `UNKNOWN:${id}`);
  };

  beforeEach(async () => {
    fixture = await buildFixture();
  });

  it.each(Object.keys(EXPECTED_VIEWS))(
    'view=%s returns exactly the right bookings in the right order',
    async view => {
      const res = await get(`/api/bookings/mine?view=${view}&pageSize=50`);

      expect(res.status).toBe(200);
      expect(names(res)).toEqual(EXPECTED_VIEWS[view]);
      expect(res.body.data.total).toBe(EXPECTED_VIEWS[view].length);
    },
  );

  it('defaults to all', async () => {
    const res = await get('/api/bookings/mine?pageSize=50');

    expect(names(res)).toEqual(EXPECTED_VIEWS.all);
  });

  it('upcoming never includes pending, past or withdrawn bookings', async () => {
    const res = await get('/api/bookings/mine?view=upcoming');

    expect(names(res)).not.toContain('pendingFuture');
    expect(names(res)).not.toContain('approvedPast');
  });

  it('cancelled mixes CANCELLED and REJECTED, distinguishable by status', async () => {
    const res = await get('/api/bookings/mine?view=cancelled');
    const statuses = res.body.data.items.map((i: { status: string }) => i.status);

    expect(statuses).toEqual(['REJECTED', 'CANCELLED', 'CANCELLED']);
  });

  it('sorts upcoming and pending ascending, everything else descending, by slot start', async () => {
    for (const view of Object.keys(EXPECTED_VIEWS)) {
      const res = await get(`/api/bookings/mine?view=${view}&pageSize=50`);
      const starts: number[] = res.body.data.items.map((i: { startAt: string }) =>
        new Date(i.startAt).getTime(),
      );
      const ascending = view === 'pending' || view === 'upcoming';
      const expected = [...starts].sort((a, b) => (ascending ? a - b : b - a));

      expect(starts, view).toEqual(expected);
    }
  });

  it('includes only the signed-in customer bookings', async () => {
    const res = await get('/api/bookings/mine?pageSize=50');

    expect(res.body.data.total).toBe(9);
    expect(JSON.stringify(res.body)).not.toContain('Isabella');
  });

  it('shows nothing to a customer with no bookings', async () => {
    const stranger = await createCustomer('nobody@example.test', 'No', 'Body', '+44 7700 900000');
    const res = await get('/api/bookings/mine', authCookie(stranger));

    expect(res.body.data).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('paginates within a view', async () => {
    const first = await get('/api/bookings/mine?view=all&pageSize=4&page=1');
    const second = await get('/api/bookings/mine?view=all&pageSize=4&page=2');
    const third = await get('/api/bookings/mine?view=all&pageSize=4&page=3');

    expect(first.body.data).toMatchObject({ total: 9, totalPages: 3, pageSize: 4 });
    expect([...names(first), ...names(second), ...names(third)]).toEqual(EXPECTED_VIEWS.all);
    expect((await get('/api/bookings/mine?page=9')).body.data.items).toEqual([]);
  });

  it('describes each booking: vehicle, dealership, times, notes, reasons and cancellation state', async () => {
    await prisma.vehicleImage.create({
      data: {
        vehicleId: data.vehicle.id,
        url: '/uploads/x/1.png',
        altText: 'Front',
        isPrimary: true,
      },
    });
    await prisma.booking.update({
      where: { id: fixture.rejectedFuture.id },
      data: { rejectionReason: 'Reserved for a press event', customerNote: 'Weekend drive' },
    });
    await prisma.booking.update({
      where: { id: fixture.approvedFuture.id },
      data: { staffNote: 'Bring your licence' },
    });
    const res = await get('/api/bookings/mine?pageSize=50');
    const item = (name: string) =>
      res.body.data.items.find((i: { id: string }) => i.id === fixture[name].id);

    expect(item('approvedFuture')).toMatchObject({
      status: 'APPROVED',
      staffNote: 'Bring your licence',
      startAt: fixture.approvedFuture.startAt.toISOString(),
      endAt: new Date(fixture.approvedFuture.startAt.getTime() + HOUR).toISOString(),
      vehicle: {
        id: data.vehicle.id,
        name: 'Porsche 911 Carrera T',
        primaryImage: { url: '/uploads/x/1.png', altText: 'Front' },
      },
      dealership: { name: 'Prestige Mayfair', city: 'London' },
      canCancel: true,
      cancelBlockedReason: null,
    });
    expect(item('rejectedFuture')).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Reserved for a press event',
      customerNote: 'Weekend drive',
      canCancel: false,
    });
    expect(item('rejectedFuture').cancelBlockedReason).toContain('declined');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects an unknown view, bad paging and unknown parameters', async () => {
    const view = await get('/api/bookings/mine?view=urgent');

    expect(view.status).toBe(422);
    expect(view.body.error.details[0].message).toContain('pending, upcoming, completed');
    for (const query of ['page=0', 'pageSize=51', 'status=PENDING']) {
      expect((await get(`/api/bookings/mine?${query}`)).status, query).toBe(422);
    }
  });

  it('requires a signed-in customer', async () => {
    expect((await request(app).get('/api/bookings/mine')).status).toBe(401);
    const staff = await get('/api/bookings/mine', staffCookie);
    expect(staff.status).toBe(403);
  });
});

describe('GET /api/bookings/mine/counts', () => {
  it('returns the count of every view, matching the lists', async () => {
    await buildFixture();
    const counts = await get('/api/bookings/mine/counts');

    expect(counts.status).toBe(200);
    expect(counts.body.data).toEqual({
      pending: 2,
      upcoming: 2,
      completed: 1,
      cancelled: 3,
      previous: 4,
      all: 9,
    });
    for (const [view, count] of Object.entries(counts.body.data)) {
      const list = await get(`/api/bookings/mine?view=${view}`);
      expect(list.body.data.total, view).toBe(count);
    }
  });

  it('counts only the signed-in customer and returns zeros when there is nothing', async () => {
    await buildFixture();
    const stranger = await createCustomer('nobody@example.test', 'No', 'Body', '+44 7700 900000');
    const res = await get('/api/bookings/mine/counts', authCookie(stranger));

    expect(res.body.data).toEqual({
      pending: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0,
      previous: 0,
      all: 0,
    });
  });

  it('follows changes immediately', async () => {
    const fixture = await buildFixture();
    await cancel(fixture.approvedFuture.id);
    const res = await get('/api/bookings/mine/counts');

    expect(res.body.data).toMatchObject({ upcoming: 1, cancelled: 4, all: 9 });
  });

  it('requires a signed-in customer', async () => {
    expect((await request(app).get('/api/bookings/mine/counts')).status).toBe(401);
    expect((await get('/api/bookings/mine/counts', staffCookie)).status).toBe(403);
  });
});

describe('cancellation eligibility: canCancel and the cancel endpoint agree', () => {
  const cases: {
    label: string;
    status: BookingStatus;
    hours: number;
    allowed: boolean;
    code?: string;
  }[] = [
    { label: 'PENDING, 3 days away', status: 'PENDING', hours: 72, allowed: true },
    { label: 'APPROVED, 3 days away', status: 'APPROVED', hours: 72, allowed: true },
    { label: 'RESCHEDULED, 3 days away', status: 'RESCHEDULED', hours: 72, allowed: true },
    { label: 'APPROVED, 25 hours away', status: 'APPROVED', hours: 25, allowed: true },
    { label: 'APPROVED, just over 24 hours away', status: 'APPROVED', hours: 24.01, allowed: true },
    {
      label: 'APPROVED, just under 24 hours away',
      status: 'APPROVED',
      hours: 23.98,
      allowed: false,
      code: 'CANCELLATION_WINDOW_PASSED',
    },
    {
      label: 'PENDING, 2 hours away',
      status: 'PENDING',
      hours: 2,
      allowed: false,
      code: 'CANCELLATION_WINDOW_PASSED',
    },
    {
      label: 'RESCHEDULED, 1 hour away',
      status: 'RESCHEDULED',
      hours: 1,
      allowed: false,
      code: 'CANCELLATION_WINDOW_PASSED',
    },
    {
      label: 'APPROVED, already started',
      status: 'APPROVED',
      hours: -1,
      allowed: false,
      code: 'CANCELLATION_WINDOW_PASSED',
    },
    {
      label: 'PENDING, long past',
      status: 'PENDING',
      hours: -72,
      allowed: false,
      code: 'CANCELLATION_WINDOW_PASSED',
    },
    {
      label: 'REJECTED, far in the future',
      status: 'REJECTED',
      hours: 72,
      allowed: false,
      code: 'INVALID_STATUS_TRANSITION',
    },
    {
      label: 'CANCELLED, far in the future',
      status: 'CANCELLED',
      hours: 72,
      allowed: false,
      code: 'INVALID_STATUS_TRANSITION',
    },
    {
      label: 'COMPLETED',
      status: 'COMPLETED',
      hours: -72,
      allowed: false,
      code: 'INVALID_STATUS_TRANSITION',
    },
  ];

  it.each(cases)('$label', async ({ status, hours, allowed, code: expectedCode }) => {
    const booking = await bookingAtHours(status, hours);
    const list = await get('/api/bookings/mine?pageSize=50');
    const item = list.body.data.items.find((i: { id: string }) => i.id === booking.id);
    const res = await cancel(booking.id, { reason: 'Plans changed' });

    expect(item.canCancel).toBe(allowed);
    if (allowed) {
      expect(item.cancelBlockedReason).toBeNull();
      expect(res.status).toBe(200);
    } else {
      expect(res.status).toBe(409);
      expect(code(res)).toBe(expectedCode);
      expect(res.body.error.message).toBe(item.cancelBlockedReason);
      const row = await stored(booking.id);
      expect(row.status).toBe(status);
      expect(row.statusHistory).toHaveLength(0);
      expect(row.notifications).toHaveLength(0);
    }
  });

  it('mentions the configured window in the message', async () => {
    const booking = await bookingAtHours('APPROVED', 5);
    const res = await cancel(booking.id);

    expect(res.body.error.message).toContain('24 hours');
  });

  it('says the test drive has started when it has', async () => {
    const booking = await bookingAtHours('APPROVED', -1);
    const res = await cancel(booking.id);

    expect(res.body.error.message).toContain('already started');
  });
});

describe('PATCH /api/bookings/:id/cancel', () => {
  it('cancels an upcoming booking, recording who, why and when', async () => {
    const booking = await bookingAtHours('APPROVED', 72);
    const res = await cancel(booking.id, { reason: '  My plans have changed.  ' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: booking.id,
      status: 'CANCELLED',
      cancelledBy: 'CUSTOMER',
      cancellationReason: 'My plans have changed.',
      canCancel: false,
    });
    expect(res.body.data.cancelBlockedReason).toContain('already been cancelled');
    const row = await stored(booking.id);
    expect(row.statusHistory).toHaveLength(1);
    expect(row.statusHistory[0]).toMatchObject({
      fromStatus: 'APPROVED',
      toStatus: 'CANCELLED',
      action: 'CANCELLED',
      note: 'My plans have changed.',
      changedById: data.customer.id,
    });
    expect(row.notifications).toHaveLength(1);
    expect(row.notifications[0]).toMatchObject({
      userId: data.customer.id,
      type: 'BOOKING_CANCELLED',
      isRead: false,
    });
    expect(row.notifications[0].message).toContain('You have cancelled');
  });

  it('works without a reason', async () => {
    const booking = await bookingAtHours('PENDING', 72);
    const blank = await bookingAtHours('PENDING', 96);
    const res = await cancel(booking.id);
    const blankRes = await cancel(blank.id, { reason: '   ' });

    expect(res.status).toBe(200);
    expect(res.body.data.cancellationReason).toBeNull();
    expect(blankRes.body.data.cancellationReason).toBeNull();
    expect((await stored(booking.id)).statusHistory[0].note).toBe('Booking cancelled');
  });

  it('frees the slot for other customers', async () => {
    const booking = await bookingAtHours('APPROVED', 72);
    await cancel(booking.id);
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const rebook = await request(app)
      .post('/api/bookings')
      .set('Cookie', authCookie(other))
      .send({ slotId: row.slotId });

    expect(rebook.status).toBe(201);
  });

  it('attempts an email after the commit and still succeeds if it fails', async () => {
    const booking = await bookingAtHours('APPROVED', 72);
    const send = vi.spyOn(mailService, 'sendMail').mockResolvedValue();
    await cancel(booking.id);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'customer@example.test' });

    const second = await bookingAtHours('APPROVED', 120);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockRejectedValue(new Error('SMTP down'));
    expect((await cancel(second.id)).status).toBe(200);
  });

  it('rolls back completely if the notification cannot be written', async () => {
    const booking = await bookingAtHours('APPROVED', 72);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(notificationService, 'notify').mockRejectedValue(new Error('disk full'));
    const res = await cancel(booking.id);

    expect(res.status).toBe(500);
    const row = await stored(booking.id);
    expect(row.status).toBe('APPROVED');
    expect(row.statusHistory).toHaveLength(0);
  });

  it('CONCURRENCY: cannot be repeated, and eight simultaneous clicks cancel exactly once', async () => {
    const booking = await bookingAtHours('APPROVED', 72);
    const results = await Promise.all(Array.from({ length: 8 }, () => cancel(booking.id)));

    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(
      results.filter(r => r.status === 409 && code(r) === 'INVALID_STATUS_TRANSITION'),
    ).toHaveLength(7);
    const row = await stored(booking.id);
    expect(row.statusHistory).toHaveLength(1);
    expect(row.notifications).toHaveLength(1);
  });

  it('CONCURRENCY: stays consistent when staff act on the same booking at the same moment', async () => {
    for (let round = 0; round < 3; round += 1) {
      const booking = await bookingAtHours('PENDING', 72 + round * 24);
      const results = await Promise.all([cancel(booking.id), staffAct(booking.id, 'approve')]);
      const row = await stored(booking.id);

      expect(results.every(r => r.status !== 500)).toBe(true);
      expect(results.filter(r => r.status === 200).length).toBe(row.statusHistory.length);
      expect(row.statusHistory.at(-1)?.toStatus ?? row.status).toBe(row.status);
    }
  });

  it('CONCURRENCY: does not deadlock when a staff reschedule races the customer cancelling', async () => {
    for (let round = 0; round < 3; round += 1) {
      const booking = await bookingAtHours('APPROVED', 72 + round * 24);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { slot: true },
      });
      const target = await addSlot(
        { ...data, vehicle: { id: row.slot.vehicleId } },
        new Date(row.slot.startAt.getTime() + 48 * HOUR),
      );
      const results = await Promise.all([
        cancel(booking.id),
        staffAct(booking.id, 'reschedule', { newSlotId: target.id }),
      ]);

      expect(
        results.every(r => r.status !== 500),
        `round ${round}`,
      ).toBe(true);
    }
  });

  describe('ownership', () => {
    it('answers 404, never 403, for someone else booking, and changes nothing', async () => {
      const other = await createCustomer(
        'isabella.rossi@example.test',
        'Isabella',
        'Rossi',
        '+44 7700 900555',
      );
      const theirs = await bookingAtHours('APPROVED', 72, other.id);
      const res = await cancel(theirs.id, { reason: 'Not mine to cancel' });
      const unknown = await cancel('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11');

      expect(res.status).toBe(404);
      expect(code(res)).toBe('NOT_FOUND');
      expect(res.body).toEqual(unknown.body);
      const row = await stored(theirs.id);
      expect(row.status).toBe('APPROVED');
      expect(row.statusHistory).toHaveLength(0);
      expect(row.notifications).toHaveLength(0);
    });

    it('is not possible for staff or anonymous callers', async () => {
      const booking = await bookingAtHours('APPROVED', 72);

      expect((await cancel(booking.id, {}, staffCookie)).status).toBe(403);
      expect((await request(app).patch(`/api/bookings/${booking.id}/cancel`).send({})).status).toBe(
        401,
      );
      expect((await stored(booking.id)).status).toBe('APPROVED');
    });
  });

  describe('validation', () => {
    it('rejects over-long reasons, unknown fields and malformed ids', async () => {
      const booking = await bookingAtHours('APPROVED', 72);

      expect((await cancel(booking.id, { reason: 'x'.repeat(501) })).status).toBe(422);
      expect((await cancel(booking.id, { reason: 'ok', status: 'APPROVED' })).status).toBe(422);
      expect((await cancel(booking.id, { cancelledBy: 'STAFF' })).status).toBe(422);
      expect((await cancel('nope')).status).toBe(422);
      expect((await stored(booking.id)).status).toBe('APPROVED');
    });

    it('accepts a reason of exactly 500 characters', async () => {
      const booking = await bookingAtHours('APPROVED', 72);

      expect((await cancel(booking.id, { reason: 'x'.repeat(500) })).status).toBe(200);
    });
  });
});

describe('GET /api/bookings/:id', () => {
  it('returns the booking with the full status history timeline, without staff identities', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const second = await addSlot(data, utcInstant(5, 14));
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({ slotId: slot.id, customerNote: 'Weekend drive' });
    const id = created.body.data.id;
    await staffAct(id, 'approve', { staffNote: 'Please bring your licence' });
    await staffAct(id, 'reschedule', { newSlotId: second.id, note: 'Vehicle service' });
    const res = await get(`/api/bookings/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id,
      status: 'RESCHEDULED',
      customerNote: 'Weekend drive',
      staffNote: 'Vehicle service',
      startAt: utcInstant(5, 14).toISOString(),
      canCancel: true,
      vehicle: { name: 'Porsche 911 Carrera T' },
      dealership: { name: 'Prestige Mayfair', openingHours: 'Mon-Sat 09:00-18:00' },
    });
    const history = res.body.data.statusHistory;
    expect(history.map((h: { action: string }) => h.action)).toEqual([
      'CREATED',
      'APPROVED',
      'RESCHEDULED',
    ]);
    expect(history.map((h: { changedBy: { label: string } }) => h.changedBy.label)).toEqual([
      'You',
      'Prestige team',
      'Prestige team',
    ]);
    expect(history[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING' });
    expect(history[2]).toMatchObject({
      fromStatus: 'APPROVED',
      toStatus: 'RESCHEDULED',
      note: 'Vehicle service',
      oldSlot: {
        id: slot.id,
        startAt: utcInstant(3, 10).toISOString(),
        dealership: { name: 'Prestige Mayfair' },
      },
      newSlot: { id: second.id, startAt: utcInstant(5, 14).toISOString() },
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('Whitfield');
    expect(raw).not.toContain('staff@example.test');
    expect(raw).not.toContain('passwordHash');
  });

  it('includes the cancellation in the timeline', async () => {
    const booking = await bookingAtHours('APPROVED', 72);
    await cancel(booking.id, { reason: 'Plans changed' });
    const res = await get(`/api/bookings/${booking.id}`);
    const last = res.body.data.statusHistory.at(-1);

    expect(last).toMatchObject({
      action: 'CANCELLED',
      note: 'Plans changed',
      changedBy: { label: 'You' },
    });
  });

  it('reports the rejection reason and that nothing can be cancelled', async () => {
    const booking = await bookingAtHours('PENDING', 72);
    await staffAct(booking.id, 'reject', { rejectionReason: 'Reserved for a press event' });
    const res = await get(`/api/bookings/${booking.id}`);

    expect(res.body.data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Reserved for a press event',
      canCancel: false,
    });
  });

  it('answers 404 for someone else booking and for unknown ids, identically', async () => {
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const theirs = await bookingAtHours('APPROVED', 72, other.id);
    const res = await get(`/api/bookings/${theirs.id}`);
    const unknown = await get('/api/bookings/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11');

    expect(res.status).toBe(404);
    expect(res.body).toEqual(unknown.body);
    expect(JSON.stringify(res.body)).not.toContain('Isabella');
  });

  it('returns 422 for a malformed id, and is closed to staff and anonymous callers', async () => {
    const booking = await bookingAtHours('APPROVED', 72);

    expect((await get('/api/bookings/nope')).status).toBe(422);
    expect((await get(`/api/bookings/${booking.id}`, staffCookie)).status).toBe(403);
    expect((await request(app).get(`/api/bookings/${booking.id}`)).status).toBe(401);
  });

  it('is not shadowed by the mine routes', async () => {
    expect((await get('/api/bookings/mine')).body.data).toHaveProperty('items');
    expect((await get('/api/bookings/mine/counts')).body.data).toHaveProperty('pending');
  });
});

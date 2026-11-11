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

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
  customerCookie = authCookie(data.customer);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const book = (slotId: string, body: object = {}, cookie = customerCookie) =>
  request(app)
    .post('/api/bookings')
    .set('Cookie', cookie)
    .send({ slotId, ...body });
const activeBookings = (slotId: string) =>
  prisma.booking.count({
    where: { slotId, status: { in: ['PENDING', 'APPROVED', 'RESCHEDULED'] } },
  });
const counts = async () => ({
  bookings: await prisma.booking.count(),
  history: await prisma.bookingStatusHistory.count(),
  notifications: await prisma.notification.count(),
});
const code = (res: request.Response): string => res.body.error.code;
const NOTHING_CREATED = { bookings: 0, history: 0, notifications: 0 };

describe('POST /api/bookings: success', () => {
  it('creates a PENDING booking and returns the full booking with vehicle, dealership, date and time', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    await prisma.vehicleImage.create({
      data: {
        vehicleId: data.vehicle.id,
        url: '/uploads/x/1.png',
        altText: 'Front',
        isPrimary: true,
      },
    });
    const res = await book(slot.id, { customerNote: '  Interested in the manual gearbox.  ' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'PENDING',
      customerNote: 'Interested in the manual gearbox.',
      staffNote: null,
      rejectionReason: null,
      cancellationReason: null,
      cancelledBy: null,
      approvedAt: null,
      completedAt: null,
      customer: { id: data.customer.id, firstName: 'Amelia', email: 'customer@example.test' },
      slot: {
        id: slot.id,
        startAt: utcInstant(3, 10).toISOString(),
        endAt: utcInstant(3, 11).toISOString(),
      },
      vehicle: {
        id: data.vehicle.id,
        manufacturer: 'Porsche',
        model: '911 Carrera T',
        year: 2025,
        primaryImage: { url: '/uploads/x/1.png', altText: 'Front' },
      },
      dealership: { id: data.dealership.id, name: 'Prestige Mayfair', city: 'London' },
    });
    expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.data.dealership).toHaveProperty('address');
  });

  it('records the booking, its history entry and a notification in one go', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const res = await book(slot.id);
    const bookingId = res.body.data.id;

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking).toMatchObject({
      customerId: data.customer.id,
      slotId: slot.id,
      status: 'PENDING',
    });
    const history = await prisma.bookingStatusHistory.findMany({ where: { bookingId } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'PENDING',
      action: 'CREATED',
      changedById: data.customer.id,
    });
    const notifications = await prisma.notification.findMany({ where: { bookingId } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      userId: data.customer.id,
      type: 'BOOKING_CREATED',
      isRead: false,
    });
    expect(notifications[0].message).toContain('Porsche 911 Carrera T');
    expect(notifications[0].message).toContain('Prestige Mayfair');
  });

  it.each([
    ['omitted', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['null', null],
  ])('stores no note when the note is %s', async (_label, customerNote) => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const res = await book(slot.id, { customerNote });

    expect(res.status).toBe(201);
    expect(res.body.data.customerNote).toBeNull();
  });

  it('takes the customer from the session, never from the request', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const res = await book(slot.id, { customerId: other.id, status: 'APPROVED' });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['customerId', 'status']),
    );
    expect(await prisma.booking.count()).toBe(0);
  });

  it('removes the slot from customer availability', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    await book(slot.id);
    const res = await request(app).get(`/api/vehicles/${data.vehicle.id}/slots`);

    expect(res.body.data.dates).toEqual([]);
  });

  it('attempts the confirmation email after the booking is committed', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    let bookingVisibleWhenSent = false;
    const send = vi.spyOn(mailService, 'sendMail').mockImplementation(async () => {
      bookingVisibleWhenSent = (await prisma.booking.count()) === 1;
    });
    const res = await book(slot.id);

    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'customer@example.test' });
    expect(send.mock.calls[0][0].subject).toContain('Porsche 911 Carrera T');
    expect(send.mock.calls[0][0].text).toContain('Prestige Mayfair');
    await vi.waitFor(() => expect(bookingVisibleWhenSent).toBe(true));
  });

  it('still succeeds when the email cannot be sent', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(mailService, 'sendMail').mockRejectedValue(new Error('SMTP connection refused'));
    const res = await book(slot.id);

    expect(res.status).toBe(201);
    expect(await prisma.booking.count()).toBe(1);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('does not send any email when the booking is refused', async () => {
    const slot = await addSlot(data, utcInstant(-1, 10));
    const send = vi.spyOn(mailService, 'sendMail').mockResolvedValue();
    await book(slot.id);

    expect(send).not.toHaveBeenCalled();
  });

  it('rolls everything back if a later step in the transaction fails', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(notificationService, 'notify').mockRejectedValue(new Error('disk full'));
    const res = await book(slot.id);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(await counts()).toEqual(NOTHING_CREATED);
    expect(await activeBookings(slot.id)).toBe(0);
  });
});

describe('POST /api/bookings: access and input', () => {
  it('requires authentication', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const res = await request(app).post('/api/bookings').send({ slotId: slot.id });

    expect(res.status).toBe(401);
    expect(code(res)).toBe('UNAUTHENTICATED');
  });

  it('is forbidden to staff', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const res = await book(slot.id, {}, authCookie(data.staff));

    expect(res.status).toBe(403);
    expect(code(res)).toBe('FORBIDDEN');
    expect(await prisma.booking.count()).toBe(0);
  });

  it('is refused for a deactivated customer', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    await prisma.user.update({ where: { id: data.customer.id }, data: { isActive: false } });
    const res = await book(slot.id);

    expect(res.status).toBe(403);
    expect(code(res)).toBe('ACCOUNT_DISABLED');
  });

  it('returns 404 for an unknown slot', async () => {
    const res = await book('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11');

    expect(res.status).toBe(404);
    expect(code(res)).toBe('NOT_FOUND');
  });

  it.each([
    ['a missing slotId', {}],
    ['a malformed slotId', { slotId: 'abc' }],
    ['a numeric slotId', { slotId: 12 }],
    [
      'a note over 500 characters',
      { slotId: '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', customerNote: 'x'.repeat(501) },
    ],
    ['a non-string note', { slotId: '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', customerNote: 42 }],
  ])('rejects %s with 422', async (_label, body) => {
    const res = await request(app).post('/api/bookings').set('Cookie', customerCookie).send(body);

    expect(res.status).toBe(422);
    expect(code(res)).toBe('VALIDATION_ERROR');
  });

  it('accepts a note of exactly 500 characters', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const res = await book(slot.id, { customerNote: 'x'.repeat(500) });

    expect(res.status).toBe(201);
  });
});

describe('POST /api/bookings: slot rules', () => {
  it('rejects a slot in the past with SLOT_IN_PAST', async () => {
    const slot = await addSlot(data, utcInstant(-1, 10));
    const res = await book(slot.id);

    expect(res.status).toBe(422);
    expect(code(res)).toBe('SLOT_IN_PAST');
    expect(await counts()).toEqual(NOTHING_CREATED);
  });

  it('rejects a slot that has just started', async () => {
    const slot = await addSlot(data, new Date(Date.now() - 60_000), {
      endAt: new Date(Date.now() + 3_540_000),
    });
    const res = await book(slot.id);

    expect(code(res)).toBe('SLOT_IN_PAST');
  });

  it('rejects an inactive slot with SLOT_UNAVAILABLE', async () => {
    const slot = await addSlot(data, utcInstant(3, 10), { isActive: false });
    const res = await book(slot.id);

    expect(res.status).toBe(409);
    expect(code(res)).toBe('SLOT_UNAVAILABLE');
    expect(await counts()).toEqual(NOTHING_CREATED);
  });

  it('rejects a slot of a deactivated vehicle', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    await prisma.vehicle.update({ where: { id: data.vehicle.id }, data: { isActive: false } });
    const res = await book(slot.id);

    expect(res.status).toBe(409);
    expect(code(res)).toBe('SLOT_UNAVAILABLE');
    expect(await counts()).toEqual(NOTHING_CREATED);
  });

  it('rejects a slot of a deactivated dealership', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { isActive: false },
    });
    const res = await book(slot.id);

    expect(res.status).toBe(409);
    expect(code(res)).toBe('SLOT_UNAVAILABLE');
  });

  it('rejects a slot whose vehicle is no longer offered at the dealership', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    await prisma.dealershipVehicle.update({
      where: {
        dealershipId_vehicleId: { dealershipId: data.dealership.id, vehicleId: data.vehicle.id },
      },
      data: { isAvailable: false },
    });
    const res = await book(slot.id);

    expect(code(res)).toBe('SLOT_UNAVAILABLE');
  });

  it.each(['PENDING', 'APPROVED', 'RESCHEDULED'] as const)(
    'rejects a slot that already has a %s booking from someone else',
    async status => {
      const slot = await addSlot(data, utcInstant(3, 10));
      const other = await createCustomer(
        'isabella.rossi@example.test',
        'Isabella',
        'Rossi',
        '+44 7700 900555',
      );
      await createBooking(other.id, slot.id, status);
      const res = await book(slot.id);

      expect(res.status).toBe(409);
      expect(code(res)).toBe('SLOT_UNAVAILABLE');
      expect(await activeBookings(slot.id)).toBe(1);
    },
  );

  it.each(['CANCELLED', 'REJECTED', 'COMPLETED'] as const)(
    'allows a slot whose previous booking ended as %s',
    async status => {
      const slot = await addSlot(data, utcInstant(3, 10));
      const other = await createCustomer(
        'isabella.rossi@example.test',
        'Isabella',
        'Rossi',
        '+44 7700 900555',
      );
      await createBooking(other.id, slot.id, status);
      const res = await book(slot.id);

      expect(res.status).toBe(201);
      expect(await activeBookings(slot.id)).toBe(1);
    },
  );

  it('rejects booking a slot the customer already holds', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    await book(slot.id);
    const again = await book(slot.id);

    expect(again.status).toBe(409);
    expect(code(again)).toBe('SLOT_UNAVAILABLE');
    expect(await prisma.booking.count()).toBe(1);
  });
});

describe('POST /api/bookings: customer limits', () => {
  let otherVehicle: Awaited<ReturnType<typeof createVehicle>>;

  beforeEach(async () => {
    otherVehicle = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, otherVehicle.id);
  });

  const otherTarget = () => ({ ...data, vehicle: otherVehicle });

  it.each([
    ['an identical time', utcInstant(3, 10), utcInstant(3, 11)],
    ['a start inside the booked time', utcInstant(3, 10, 30), utcInstant(3, 11, 30)],
    ['an end inside the booked time', utcInstant(3, 9, 30), utcInstant(3, 10, 30)],
    ['a slot containing the booked time', utcInstant(3, 9), utcInstant(3, 12)],
    ['a slot inside the booked time', utcInstant(3, 10, 15), utcInstant(3, 10, 45)],
  ])('rejects an overlapping slot of another vehicle with %s', async (_label, startAt, endAt) => {
    const first = await addSlot(data, utcInstant(3, 10));
    const second = await addSlot(otherTarget(), startAt, { endAt });
    expect((await book(first.id)).status).toBe(201);
    const res = await book(second.id);

    expect(res.status).toBe(409);
    expect(code(res)).toBe('BOOKING_CONFLICT');
    expect(res.body.error.message).toContain('Porsche 911 Carrera T');
    expect(await prisma.booking.count()).toBe(1);
  });

  it('allows back-to-back slots', async () => {
    const first = await addSlot(data, utcInstant(3, 10));
    const second = await addSlot(otherTarget(), utcInstant(3, 11));
    await book(first.id);

    expect((await book(second.id)).status).toBe(201);
  });

  it('ignores cancelled bookings and other customers when checking overlaps', async () => {
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const held = await addSlot(data, utcInstant(3, 10));
    const clashing = await addSlot(otherTarget(), utcInstant(3, 10, 30));
    await createBooking(other.id, held.id, 'APPROVED');
    const cancelled = await addSlot(data, utcInstant(3, 10, 30), { isActive: false });
    await createBooking(data.customer.id, cancelled.id, 'CANCELLED');

    expect((await book(clashing.id)).status).toBe(201);
  });

  it('limits a customer to 3 active bookings and says so', async () => {
    const slots = await Promise.all(
      [9, 11, 13, 15].map(hour => addSlot(data, utcInstant(3, hour))),
    );
    for (const slot of slots.slice(0, 3)) expect((await book(slot.id)).status).toBe(201);
    const res = await book(slots[3].id);

    expect(res.status).toBe(409);
    expect(code(res)).toBe('ACTIVE_BOOKING_LIMIT');
    expect(res.body.error.message).toContain('3');
    expect(await prisma.booking.count()).toBe(3);
  });

  it('frees a place when an active booking is cancelled or finished', async () => {
    const slots = await Promise.all(
      [9, 11, 13, 15, 17].map(hour => addSlot(data, utcInstant(3, hour))),
    );
    for (const slot of slots.slice(0, 3)) await book(slot.id);
    expect(code(await book(slots[3].id))).toBe('ACTIVE_BOOKING_LIMIT');

    await prisma.booking.updateMany({
      where: { slotId: slots[0].id },
      data: { status: 'CANCELLED' },
    });
    expect((await book(slots[3].id)).status).toBe(201);

    await prisma.booking.updateMany({
      where: { slotId: slots[1].id },
      data: { status: 'COMPLETED' },
    });
    expect((await book(slots[4].id)).status).toBe(201);
  });

  it('counts active bookings of every kind but not final ones', async () => {
    const [a, b, c, d] = await Promise.all(
      [9, 11, 13, 15].map(hour => addSlot(data, utcInstant(4, hour))),
    );
    await createBooking(data.customer.id, a.id, 'APPROVED');
    await createBooking(data.customer.id, b.id, 'RESCHEDULED');
    await createBooking(data.customer.id, c.id, 'PENDING');
    const blocked = await book(d.id);

    expect(code(blocked)).toBe('ACTIVE_BOOKING_LIMIT');
  });

  it('does not count another customer bookings towards the limit', async () => {
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const slots = await Promise.all(
      [9, 11, 13, 15].map(hour => addSlot(data, utcInstant(3, hour))),
    );
    for (const slot of slots.slice(0, 3)) await createBooking(other.id, slot.id, 'APPROVED');
    const free = await addSlot(data, utcInstant(5, 9));

    expect((await book(free.id)).status).toBe(201);
  });

  it('reports a time conflict before the limit when both apply', async () => {
    const slots = await Promise.all([9, 11, 13].map(hour => addSlot(data, utcInstant(3, hour))));
    for (const slot of slots) await book(slot.id);
    const clashing = await addSlot(otherTarget(), utcInstant(3, 9, 30));

    expect(code(await book(clashing.id))).toBe('BOOKING_CONFLICT');
  });
});

describe('error translation for the active-slot unique index', () => {
  it('maps a Prisma unique violation to SLOT_UNAVAILABLE', async () => {
    const { Prisma } = await import('@prisma/client');
    const { translateBookingError } = await import('../src/services/bookingRules');
    const violation = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const translated = translateBookingError(violation);

    expect(translated).toMatchObject({ status: 409, code: 'SLOT_UNAVAILABLE' });
  });

  it('maps a raw 23505 / index-name error to SLOT_UNAVAILABLE and leaves other errors alone', async () => {
    const { translateBookingError } = await import('../src/services/bookingRules');
    const raw = new Error(
      'duplicate key value violates unique constraint "one_active_booking_per_slot"',
    );
    const other = new Error('connection reset');

    expect(translateBookingError(raw)).toMatchObject({ status: 409, code: 'SLOT_UNAVAILABLE' });
    expect(translateBookingError(new Error('code: "23505"'))).toMatchObject({
      code: 'SLOT_UNAVAILABLE',
    });
    expect(translateBookingError(other)).toBe(other);
  });

  it('is backed by the database itself: a second active booking cannot be inserted', async () => {
    const slot = await addSlot(data, utcInstant(3, 10));
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    await createBooking(data.customer.id, slot.id, 'PENDING');

    await expect(createBooking(other.id, slot.id, 'APPROVED')).rejects.toMatchObject({
      code: 'P2002',
    });
    await expect(createBooking(other.id, slot.id, 'RESCHEDULED')).rejects.toMatchObject({
      code: 'P2002',
    });
    await expect(createBooking(other.id, slot.id, 'CANCELLED')).resolves.toBeDefined();
  });
});

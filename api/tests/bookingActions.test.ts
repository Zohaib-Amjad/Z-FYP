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
let customerCount = 0;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
  staffCookie = authCookie(data.staff);
  customerCount = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

type Action = 'approve' | 'reject' | 'reschedule' | 'cancel' | 'complete';

const act = (bookingId: string, action: Action, body: object = {}, cookie = staffCookie) =>
  request(app).patch(`/api/admin/bookings/${bookingId}/${action}`).set('Cookie', cookie).send(body);

const newCustomer = () => {
  customerCount += 1;
  return createCustomer(
    `guest${customerCount}@example.test`,
    `Guest${customerCount}`,
    'Visitor',
    '+44 7700 900100',
  );
};

interface MadeBooking {
  id: string;
  slotId: string;
  customerId: string;
}

const makeBooking = async (
  status: BookingStatus,
  options: { days?: number; hour?: number; customerId?: string; target?: typeof data } = {},
): Promise<MadeBooking> => {
  const customerId = options.customerId ?? (await newCustomer()).id;
  const slot = await addSlot(
    options.target ?? data,
    utcInstant(options.days ?? 3, options.hour ?? 10),
  );
  const booking = await createBooking(customerId, slot.id, status);
  return { id: booking.id, slotId: slot.id, customerId };
};

const stored = (id: string) =>
  prisma.booking.findUniqueOrThrow({
    where: { id },
    include: { statusHistory: { orderBy: { createdAt: 'asc' } }, notifications: true },
  });

const freeSlot = (days = 6, hour = 10, target = data) => addSlot(target, utcInstant(days, hour));
const REASON = 'The vehicle is needed for a press event.';
const code = (res: request.Response): string => res.body.error.code;

describe('access control and identifiers', () => {
  const actions: Action[] = ['approve', 'reject', 'reschedule', 'cancel', 'complete'];
  const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';
  const validBody: Record<Action, object> = {
    approve: {},
    reject: { rejectionReason: REASON },
    reschedule: { newSlotId: id },
    cancel: { cancellationReason: REASON },
    complete: {},
  };

  it.each(actions)('%s requires authentication', async action => {
    const res = await request(app)
      .patch(`/api/admin/bookings/${id}/${action}`)
      .send(validBody[action]);

    expect(res.status).toBe(401);
  });

  it.each(actions)('%s is forbidden to customers and leaves the booking alone', async action => {
    const booking = await makeBooking('PENDING');
    const res = await act(booking.id, action, validBody[action], authCookie(data.customer));

    expect(res.status).toBe(403);
    expect(code(res)).toBe('FORBIDDEN');
    expect((await stored(booking.id)).status).toBe('PENDING');
  });

  it.each(actions)('%s returns 404 for an unknown booking', async action => {
    const body = action === 'reschedule' ? { newSlotId: (await freeSlot()).id } : validBody[action];
    const res = await act(id, action, body);

    expect(res.status).toBe(404);
    expect(code(res)).toBe('NOT_FOUND');
  });

  it.each(actions)('%s returns 422 for a malformed booking id', async action => {
    const res = await request(app)
      .patch(`/api/admin/bookings/nope/${action}`)
      .set('Cookie', staffCookie)
      .send(validBody[action]);

    expect(res.status).toBe(422);
  });
});

describe('approve', () => {
  it('approves a pending booking, sets approvedAt and stores the staff note', async () => {
    const booking = await makeBooking('PENDING');
    const res = await act(booking.id, 'approve', { staffNote: '  Please bring your licence.  ' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: booking.id,
      status: 'APPROVED',
      staffNote: 'Please bring your licence.',
      vehicle: { manufacturer: 'Porsche' },
      dealership: { name: 'Prestige Mayfair' },
    });
    expect(typeof res.body.data.approvedAt).toBe('string');
    const row = await stored(booking.id);
    expect(row.approvedAt).toBeInstanceOf(Date);
  });

  it('works without a note and ignores a blank one', async () => {
    const first = await makeBooking('PENDING');
    const second = await makeBooking('PENDING', { hour: 12 });

    expect((await act(first.id, 'approve')).body.data.staffNote).toBeNull();
    expect((await act(second.id, 'approve', { staffNote: '   ' })).body.data.staffNote).toBeNull();
  });

  it('writes a history row and a notification for the right customer', async () => {
    const booking = await makeBooking('PENDING');
    await act(booking.id, 'approve', { staffNote: 'See you soon' });
    const row = await stored(booking.id);

    expect(row.statusHistory).toHaveLength(1);
    expect(row.statusHistory[0]).toMatchObject({
      fromStatus: 'PENDING',
      toStatus: 'APPROVED',
      action: 'APPROVED',
      note: 'See you soon',
      changedById: data.staff.id,
      oldSlotId: null,
      newSlotId: null,
    });
    expect(row.notifications).toHaveLength(1);
    expect(row.notifications[0]).toMatchObject({
      userId: booking.customerId,
      type: 'BOOKING_APPROVED',
      isRead: false,
    });
    expect(row.notifications[0].message).toContain('Porsche 911 Carrera T');
    expect(row.notifications[0].message).toContain('See you soon');
  });

  it('rejects unknown fields and over-long notes', async () => {
    const booking = await makeBooking('PENDING');

    expect((await act(booking.id, 'approve', { status: 'COMPLETED' })).status).toBe(422);
    expect((await act(booking.id, 'approve', { staffNote: 'x'.repeat(501) })).status).toBe(422);
    expect((await stored(booking.id)).status).toBe('PENDING');
  });

  it('is safe to repeat: re-approving fails clearly and changes nothing', async () => {
    const booking = await makeBooking('PENDING');
    await act(booking.id, 'approve');
    const again = await act(booking.id, 'approve');

    expect(again.status).toBe(409);
    expect(code(again)).toBe('INVALID_STATUS_TRANSITION');
    expect(again.body.error.message).toContain('from APPROVED to APPROVED');
    const row = await stored(booking.id);
    expect(row.statusHistory).toHaveLength(1);
    expect(row.notifications).toHaveLength(1);
  });
});

describe('reject', () => {
  it('rejects a pending booking with a reason and records it', async () => {
    const booking = await makeBooking('PENDING');
    const res = await act(booking.id, 'reject', { rejectionReason: `  ${REASON}  ` });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: REASON });
    const row = await stored(booking.id);
    expect(row.statusHistory[0]).toMatchObject({
      fromStatus: 'PENDING',
      toStatus: 'REJECTED',
      action: 'REJECTED',
      note: REASON,
      changedById: data.staff.id,
    });
    expect(row.notifications[0]).toMatchObject({
      type: 'BOOKING_REJECTED',
      userId: booking.customerId,
    });
    expect(row.notifications[0].message).toContain(REASON.replace(/\.$/, ''));
  });

  it.each([
    ['missing', {}],
    ['empty', { rejectionReason: '' }],
    ['blank', { rejectionReason: '        ' }],
    ['shorter than 5 characters', { rejectionReason: 'Nope' }],
    ['longer than 500 characters', { rejectionReason: 'x'.repeat(501) }],
    ['the wrong field name', { reason: REASON }],
  ])('requires a valid reason (%s)', async (_label, body) => {
    const booking = await makeBooking('PENDING');
    const res = await act(booking.id, 'reject', body);

    expect(res.status).toBe(422);
    expect((await stored(booking.id)).status).toBe('PENDING');
  });

  it('accepts a reason of exactly 5 characters', async () => {
    const booking = await makeBooking('PENDING');

    expect((await act(booking.id, 'reject', { rejectionReason: 'Fiver' })).status).toBe(200);
  });

  it('frees the slot automatically so someone else can book it', async () => {
    const booking = await makeBooking('PENDING');
    await act(booking.id, 'reject', { rejectionReason: REASON });
    const other = await newCustomer();
    const rebook = await request(app)
      .post('/api/bookings')
      .set('Cookie', authCookie(other))
      .send({ slotId: booking.slotId });

    expect(rebook.status).toBe(201);
    const visible = await request(app).get(`/api/vehicles/${data.vehicle.id}/slots`);
    expect(visible.body.data.dates).toEqual([]);
  });

  it('cannot be repeated', async () => {
    const booking = await makeBooking('PENDING');
    await act(booking.id, 'reject', { rejectionReason: REASON });
    const again = await act(booking.id, 'reject', { rejectionReason: REASON });

    expect(again.status).toBe(409);
    expect(code(again)).toBe('INVALID_STATUS_TRANSITION');
    expect((await stored(booking.id)).statusHistory).toHaveLength(1);
  });
});

describe('cancel (staff)', () => {
  it.each(['PENDING', 'APPROVED', 'RESCHEDULED'] as const)(
    'cancels a %s booking, recording the reason and that staff cancelled it',
    async status => {
      const booking = await makeBooking(status);
      const res = await act(booking.id, 'cancel', { cancellationReason: REASON });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: 'CANCELLED',
        cancellationReason: REASON,
        cancelledBy: 'STAFF',
      });
      const row = await stored(booking.id);
      expect(row.statusHistory[0]).toMatchObject({
        fromStatus: status,
        toStatus: 'CANCELLED',
        action: 'CANCELLED',
        note: REASON,
        changedById: data.staff.id,
      });
      expect(row.notifications[0]).toMatchObject({
        type: 'BOOKING_CANCELLED',
        userId: booking.customerId,
      });
      expect(row.notifications[0].message).toContain('cancelled by our team');
    },
  );

  it('works at any time, even an hour before the slot or after it has passed', async () => {
    const soon = await addSlot(data, new Date(Date.now() + 3_600_000), {
      endAt: new Date(Date.now() + 7_200_000),
    });
    const soonBooking = await createBooking((await newCustomer()).id, soon.id, 'APPROVED');
    const past = await makeBooking('APPROVED', { days: -2 });

    expect((await act(soonBooking.id, 'cancel', { cancellationReason: REASON })).status).toBe(200);
    expect((await act(past.id, 'cancel', { cancellationReason: REASON })).status).toBe(200);
  });

  it.each([
    ['missing', {}],
    ['blank', { cancellationReason: '   ' }],
    ['too short', { cancellationReason: 'No' }],
    ['the wrong field name', { reason: REASON }],
  ])('requires a valid reason (%s)', async (_label, body) => {
    const booking = await makeBooking('APPROVED');
    const res = await act(booking.id, 'cancel', body);

    expect(res.status).toBe(422);
    expect((await stored(booking.id)).status).toBe('APPROVED');
  });

  it('frees the slot again', async () => {
    const booking = await makeBooking('APPROVED');
    await act(booking.id, 'cancel', { cancellationReason: REASON });
    const visible = await request(app).get(`/api/vehicles/${data.vehicle.id}/slots`);

    expect(Object.values<unknown[]>(visible.body.data.slotsByDate).flat()).toHaveLength(1);
  });
});

describe('complete', () => {
  it.each(['APPROVED', 'RESCHEDULED'] as const)(
    'completes a %s booking once its slot has started',
    async status => {
      const booking = await makeBooking(status, { days: -2 });
      const res = await act(booking.id, 'complete', { staffNote: 'Customer enjoyed the drive' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: 'COMPLETED',
        staffNote: 'Customer enjoyed the drive',
      });
      expect(typeof res.body.data.completedAt).toBe('string');
      const row = await stored(booking.id);
      expect(row.statusHistory[0]).toMatchObject({
        fromStatus: status,
        toStatus: 'COMPLETED',
        action: 'COMPLETED',
        note: 'Customer enjoyed the drive',
      });
      expect(row.notifications[0]).toMatchObject({
        type: 'BOOKING_COMPLETED',
        userId: booking.customerId,
      });
    },
  );

  it('refuses a future slot with INVALID_STATUS_TRANSITION and a clear message', async () => {
    const booking = await makeBooking('APPROVED', { days: 2 });
    const res = await act(booking.id, 'complete');

    expect(res.status).toBe(409);
    expect(code(res)).toBe('INVALID_STATUS_TRANSITION');
    expect(res.body.error.message).toContain('before its test drive has started');
    const row = await stored(booking.id);
    expect(row.status).toBe('APPROVED');
    expect(row.statusHistory).toHaveLength(0);
  });

  it('refuses a slot that has not quite started, and accepts one that just has', async () => {
    const upcoming = await addSlot(data, new Date(Date.now() + 7_200_000), {
      endAt: new Date(Date.now() + 10_800_000),
    });
    const started = await addSlot(data, new Date(Date.now() - 120_000), {
      endAt: new Date(Date.now() + 3_480_000),
    });
    const early = await createBooking((await newCustomer()).id, upcoming.id, 'APPROVED');
    const ready = await createBooking((await newCustomer()).id, started.id, 'APPROVED');

    expect((await act(early.id, 'complete')).status).toBe(409);
    expect((await act(ready.id, 'complete')).status).toBe(200);
  });

  it('works without a note', async () => {
    const booking = await makeBooking('APPROVED', { days: -1 });

    expect((await act(booking.id, 'complete')).body.data.staffNote).toBeNull();
  });
});

describe('reschedule', () => {
  it.each(['PENDING', 'APPROVED', 'RESCHEDULED'] as const)(
    'moves a %s booking to a free slot of the same vehicle',
    async status => {
      const booking = await makeBooking(status, { days: 3 });
      const target = await freeSlot(5, 14);
      const res = await act(booking.id, 'reschedule', {
        newSlotId: target.id,
        note: 'Vehicle service',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: 'RESCHEDULED',
        staffNote: 'Vehicle service',
        slot: { id: target.id, startAt: utcInstant(5, 14).toISOString() },
      });
      const row = await stored(booking.id);
      expect(row.slotId).toBe(target.id);
      expect(row.statusHistory[0]).toMatchObject({
        fromStatus: status,
        toStatus: 'RESCHEDULED',
        action: 'RESCHEDULED',
        oldSlotId: booking.slotId,
        newSlotId: target.id,
        note: 'Vehicle service',
        changedById: data.staff.id,
      });
      expect(row.notifications[0]).toMatchObject({
        type: 'BOOKING_RESCHEDULED',
        userId: booking.customerId,
      });
    },
  );

  it('tells the customer the old and the new time', async () => {
    const booking = await makeBooking('APPROVED', { days: 3, hour: 10 });
    const target = await freeSlot(5, 14);
    await act(booking.id, 'reschedule', { newSlotId: target.id });
    const [notification] = (await stored(booking.id)).notifications;

    expect(notification.message).toContain('moved from');
    expect(notification.message).toContain('10:00 to 11:00 UTC');
    expect(notification.message).toContain('14:00 to 15:00 UTC');
  });

  it('frees the old slot and occupies the new one', async () => {
    const booking = await makeBooking('APPROVED', { days: 3 });
    const target = await freeSlot(5, 14);
    await act(booking.id, 'reschedule', { newSlotId: target.id });
    const visible = await request(app).get(`/api/vehicles/${data.vehicle.id}/slots`);
    const ids = Object.values<{ id: string }[]>(visible.body.data.slotsByDate)
      .flat()
      .map(s => s.id);

    expect(ids).toEqual([booking.slotId]);
    const other = await newCustomer();
    const rebook = await request(app)
      .post('/api/bookings')
      .set('Cookie', authCookie(other))
      .send({ slotId: booking.slotId });
    expect(rebook.status).toBe(201);
  });

  it('can be repeated, each time freeing the previous slot', async () => {
    const booking = await makeBooking('PENDING', { days: 3 });
    const second = await freeSlot(5, 10);
    const third = await freeSlot(6, 10);
    await act(booking.id, 'reschedule', { newSlotId: second.id });
    const again = await act(booking.id, 'reschedule', { newSlotId: third.id });

    expect(again.status).toBe(200);
    const row = await stored(booking.id);
    expect(row.slotId).toBe(third.id);
    expect(row.statusHistory.map(h => [h.oldSlotId, h.newSlotId])).toEqual([
      [booking.slotId, second.id],
      [second.id, third.id],
    ]);
    expect(
      await prisma.booking.count({ where: { slotId: { in: [booking.slotId, second.id] } } }),
    ).toBe(0);
  });

  it('allows a different dealership when the vehicle is offered there', async () => {
    const booking = await makeBooking('APPROVED', { days: 3 });
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(manchester.id, data.vehicle.id);
    const target = await freeSlot(5, 10, { ...data, dealership: manchester });
    const res = await act(booking.id, 'reschedule', { newSlotId: target.id });

    expect(res.status).toBe(200);
    expect(res.body.data.dealership).toMatchObject({ name: 'Prestige Deansgate' });
    const [notification] = (await stored(booking.id)).notifications;
    expect(notification.message).toContain('at Prestige Mayfair');
    expect(notification.message).toContain('at Prestige Deansgate');
  });

  it('refuses a dealership that no longer offers the vehicle or is deactivated', async () => {
    const booking = await makeBooking('APPROVED', { days: 3 });
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(manchester.id, data.vehicle.id);
    const target = await freeSlot(5, 10, { ...data, dealership: manchester });
    await prisma.dealershipVehicle.update({
      where: {
        dealershipId_vehicleId: { dealershipId: manchester.id, vehicleId: data.vehicle.id },
      },
      data: { isAvailable: false },
    });
    const unavailable = await act(booking.id, 'reschedule', { newSlotId: target.id });
    await prisma.dealershipVehicle.update({
      where: {
        dealershipId_vehicleId: { dealershipId: manchester.id, vehicleId: data.vehicle.id },
      },
      data: { isAvailable: true },
    });
    await prisma.dealership.update({ where: { id: manchester.id }, data: { isActive: false } });
    const inactive = await act(booking.id, 'reschedule', { newSlotId: target.id });

    expect(code(unavailable)).toBe('SLOT_UNAVAILABLE');
    expect(code(inactive)).toBe('SLOT_UNAVAILABLE');
    expect((await stored(booking.id)).slotId).toBe(booking.slotId);
  });

  it('refuses a slot of a different vehicle', async () => {
    const booking = await makeBooking('APPROVED', { days: 3 });
    const other = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, other.id);
    const target = await freeSlot(5, 10, { ...data, vehicle: other });
    const res = await act(booking.id, 'reschedule', { newSlotId: target.id });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0]).toMatchObject({ field: 'newSlotId' });
    expect((await stored(booking.id)).slotId).toBe(booking.slotId);
  });

  it('refuses the slot the booking already has', async () => {
    const booking = await makeBooking('APPROVED');
    const res = await act(booking.id, 'reschedule', { newSlotId: booking.slotId });

    expect(res.status).toBe(422);
    expect((await stored(booking.id)).statusHistory).toHaveLength(0);
  });

  it('fails on a taken slot and leaves every row untouched', async () => {
    const booking = await makeBooking('APPROVED', { days: 3, hour: 10 });
    const taken = await makeBooking('PENDING', { days: 5, hour: 10 });
    const before = await stored(booking.id);
    const res = await act(booking.id, 'reschedule', { newSlotId: taken.slotId });

    expect(res.status).toBe(409);
    expect(code(res)).toBe('SLOT_UNAVAILABLE');
    const after = await stored(booking.id);
    expect(after.slotId).toBe(before.slotId);
    expect(after.status).toBe('APPROVED');
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.statusHistory).toHaveLength(0);
    expect(after.notifications).toHaveLength(0);
    expect((await stored(taken.id)).slotId).toBe(taken.slotId);
  });

  it.each([
    [
      'an inactive slot',
      async () => addSlot(data, utcInstant(5, 10), { isActive: false }),
      409,
      'SLOT_UNAVAILABLE',
    ],
    ['a slot in the past', async () => addSlot(data, utcInstant(-1, 10)), 422, 'SLOT_IN_PAST'],
  ])('refuses %s', async (_label, makeTarget, status, errorCode) => {
    const booking = await makeBooking('APPROVED', { days: 3 });
    const target = await makeTarget();
    const res = await act(booking.id, 'reschedule', { newSlotId: target.id });

    expect(res.status).toBe(status);
    expect(code(res)).toBe(errorCode);
    expect((await stored(booking.id)).slotId).toBe(booking.slotId);
  });

  it('returns 404 for an unknown new slot and 422 for a malformed or missing one', async () => {
    const booking = await makeBooking('APPROVED');

    expect(
      (await act(booking.id, 'reschedule', { newSlotId: '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11' }))
        .status,
    ).toBe(404);
    expect((await act(booking.id, 'reschedule', { newSlotId: 'abc' })).status).toBe(422);
    expect((await act(booking.id, 'reschedule', {})).status).toBe(422);
    expect(
      (await act(booking.id, 'reschedule', { newSlotId: 'x', status: 'APPROVED' })).status,
    ).toBe(422);
  });

  it('re-checks the customer overlap rule against their other bookings', async () => {
    const customer = await newCustomer();
    const other = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, other.id);
    const mine = await makeBooking('APPROVED', { customerId: customer.id, days: 3, hour: 10 });
    const otherSlot = await addSlot({ ...data, vehicle: other }, utcInstant(5, 14));
    await createBooking(customer.id, otherSlot.id, 'APPROVED');
    const clashing = await freeSlot(5, 14);
    const res = await act(mine.id, 'reschedule', { newSlotId: clashing.id });

    expect(res.status).toBe(409);
    expect(code(res)).toBe('BOOKING_CONFLICT');
    expect((await stored(mine.id)).slotId).toBe(mine.slotId);
  });

  it('is not blocked by the active-booking limit, because the booking count does not change', async () => {
    const customer = await newCustomer();
    const first = await makeBooking('APPROVED', { customerId: customer.id, days: 3, hour: 8 });
    await makeBooking('APPROVED', { customerId: customer.id, days: 3, hour: 12 });
    await makeBooking('PENDING', { customerId: customer.id, days: 3, hour: 16 });
    const target = await freeSlot(5, 10);
    const res = await act(first.id, 'reschedule', { newSlotId: target.id });

    expect(res.status).toBe(200);
    expect(
      await prisma.booking.count({
        where: { customerId: customer.id, status: { in: ['PENDING', 'APPROVED', 'RESCHEDULED'] } },
      }),
    ).toBe(3);
  });

  it.each(['REJECTED', 'CANCELLED', 'COMPLETED'] as const)(
    'refuses to reschedule a %s booking',
    async status => {
      const booking = await makeBooking(status);
      const target = await freeSlot();
      const res = await act(booking.id, 'reschedule', { newSlotId: target.id });

      expect(res.status).toBe(409);
      expect(code(res)).toBe('INVALID_STATUS_TRANSITION');
    },
  );
});

const ALL: BookingStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'RESCHEDULED',
];
const ALLOWED: Record<Action, BookingStatus[]> = {
  approve: ['PENDING'],
  reject: ['PENDING'],
  cancel: ['PENDING', 'APPROVED', 'RESCHEDULED'],
  complete: ['APPROVED', 'RESCHEDULED'],
  reschedule: ['PENDING', 'APPROVED', 'RESCHEDULED'],
};
const RESULT: Record<Action, BookingStatus> = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  cancel: 'CANCELLED',
  complete: 'COMPLETED',
  reschedule: 'RESCHEDULED',
};
const REQUESTED: Record<Action, BookingStatus> = RESULT;

describe('full transition matrix (every action from every status)', () => {
  const cases = (Object.keys(ALLOWED) as Action[]).flatMap(action =>
    ALL.map(status => ({ action, status, allowed: ALLOWED[action].includes(status) })),
  );

  const bodyFor = async (action: Action): Promise<object> => {
    if (action === 'reject') return { rejectionReason: REASON };
    if (action === 'cancel') return { cancellationReason: REASON };
    if (action === 'reschedule') return { newSlotId: (await freeSlot(8, 10)).id };
    return {};
  };

  it.each(cases)(
    '$action from $status (allowed: $allowed)',
    async ({ action, status, allowed }) => {
      const booking = await makeBooking(status, { days: -2 });
      const before = await stored(booking.id);
      const res = await act(booking.id, action, await bodyFor(action));
      const after = await stored(booking.id);

      if (allowed) {
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(RESULT[action]);
        expect(after.status).toBe(RESULT[action]);
        expect(after.statusHistory).toHaveLength(1);
        expect(after.statusHistory[0]).toMatchObject({
          fromStatus: status,
          toStatus: RESULT[action],
        });
        expect(after.notifications).toHaveLength(1);
      } else {
        expect(res.status).toBe(409);
        expect(code(res)).toBe('INVALID_STATUS_TRANSITION');
        expect(res.body.error.message).toContain(`from ${status} to ${REQUESTED[action]}`);
        expect(after.status).toBe(before.status);
        expect(after.slotId).toBe(before.slotId);
        expect(after.statusHistory).toHaveLength(0);
        expect(after.notifications).toHaveLength(0);
      }
    },
  );
});

describe('emails and failures', () => {
  it('attempts one email per action, after the commit, to the booking customer', async () => {
    const booking = await makeBooking('PENDING');
    const visibleAtSend: boolean[] = [];
    const send = vi.spyOn(mailService, 'sendMail').mockImplementation(async () => {
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      visibleAtSend.push(row.status === 'APPROVED');
    });
    await act(booking.id, 'approve');

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toMatchObject({ to: expect.stringContaining('@example.test') });
    expect(send.mock.calls[0][0].subject).toContain('Test drive confirmed');
    await vi.waitFor(() => expect(visibleAtSend).toEqual([true]));
  });

  it('still succeeds when the email cannot be sent', async () => {
    const booking = await makeBooking('PENDING');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(mailService, 'sendMail').mockRejectedValue(new Error('SMTP down'));
    const res = await act(booking.id, 'reject', { rejectionReason: REASON });

    expect(res.status).toBe(200);
    expect((await stored(booking.id)).status).toBe('REJECTED');
  });

  it('sends nothing when the action is refused', async () => {
    const booking = await makeBooking('REJECTED');
    const send = vi.spyOn(mailService, 'sendMail').mockResolvedValue();
    await act(booking.id, 'approve');
    await act(booking.id, 'reject', { rejectionReason: 'x' });

    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['approve', {}],
    ['reject', { rejectionReason: REASON }],
    ['cancel', { cancellationReason: REASON }],
  ] as [Action, object][])(
    'rolls %s back completely if the notification cannot be written',
    async (action, body) => {
      const booking = await makeBooking('PENDING');
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(notificationService, 'notify').mockRejectedValue(new Error('disk full'));
      const res = await act(booking.id, action, body);

      expect(res.status).toBe(500);
      const row = await stored(booking.id);
      expect(row.status).toBe('PENDING');
      expect(row.approvedAt).toBeNull();
      expect(row.statusHistory).toHaveLength(0);
    },
  );

  it('rolls a reschedule back completely if the notification cannot be written', async () => {
    const booking = await makeBooking('APPROVED', { days: 3 });
    const target = await freeSlot();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(notificationService, 'notify').mockRejectedValue(new Error('disk full'));
    const res = await act(booking.id, 'reschedule', { newSlotId: target.id });

    expect(res.status).toBe(500);
    const row = await stored(booking.id);
    expect(row.slotId).toBe(booking.slotId);
    expect(row.status).toBe('APPROVED');
    expect(await prisma.booking.count({ where: { slotId: target.id } })).toBe(0);
  });
});

describe('CONCURRENCY: two staff members acting at the same moment', () => {
  const successes = (results: request.Response[]): number =>
    results.filter(r => r.status === 200).length;
  const transitionErrors = (results: request.Response[]): number =>
    results.filter(r => r.status === 409 && code(r) === 'INVALID_STATUS_TRANSITION').length;

  const bothMayWin = new Set(['approve+cancel']);

  it('lets only one of two simultaneous approvals succeed', async () => {
    const booking = await makeBooking('PENDING');
    const results = await Promise.all([act(booking.id, 'approve'), act(booking.id, 'approve')]);

    expect(successes(results)).toBe(1);
    expect(transitionErrors(results)).toBe(1);
    const row = await stored(booking.id);
    expect(row.statusHistory).toHaveLength(1);
    expect(row.notifications).toHaveLength(1);
  });

  it('lets only one of eight simultaneous cancellations succeed', async () => {
    const booking = await makeBooking('APPROVED');
    const results = await Promise.all(
      Array.from({ length: 8 }, () => act(booking.id, 'cancel', { cancellationReason: REASON })),
    );

    expect(successes(results)).toBe(1);
    expect(transitionErrors(results)).toBe(7);
    expect((await stored(booking.id)).statusHistory).toHaveLength(1);
  });

  it.each([
    ['approve and reject', 'approve', {}, 'reject', { rejectionReason: REASON }],
    ['approve and cancel', 'approve', {}, 'cancel', { cancellationReason: REASON }],
    [
      'reject and cancel',
      'reject',
      { rejectionReason: REASON },
      'cancel',
      { cancellationReason: REASON },
    ],
  ] as [string, Action, object, Action, object][])(
    'applies %s in a legal order and the final state matches its history',
    async (_label, first, firstBody, second, secondBody) => {
      for (let round = 0; round < 3; round += 1) {
        const booking = await makeBooking('PENDING', { days: 3 + round });
        const results = await Promise.all([
          act(booking.id, first, firstBody),
          act(booking.id, second, secondBody),
        ]);
        const row = await stored(booking.id);

        const won = successes(results);
        const bothLegal = bothMayWin.has(`${first}+${second}`);

        expect(won, `round ${round}`).toBeGreaterThanOrEqual(1);
        expect(won).toBeLessThanOrEqual(bothLegal ? 2 : 1);
        expect(transitionErrors(results)).toBe(2 - won);
        expect(row.statusHistory).toHaveLength(won);
        expect(row.notifications).toHaveLength(won);
        let expectedFrom = 'PENDING';
        for (const entry of row.statusHistory) {
          expect(entry.fromStatus).toBe(expectedFrom);
          expectedFrom = entry.toStatus;
        }
        expect(expectedFrom).toBe(row.status);
      }
    },
  );

  it('reflects a change made by someone else in the meantime', async () => {
    const booking = await makeBooking('PENDING');
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
    const res = await act(booking.id, 'approve');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('from CANCELLED to APPROVED');
  });

  it('gives a contested target slot to exactly one of two simultaneous reschedules', async () => {
    const first = await makeBooking('APPROVED', { days: 3, hour: 8 });
    const second = await makeBooking('APPROVED', { days: 3, hour: 12 });
    const target = await freeSlot(6, 10);
    const results = await Promise.all([
      act(first.id, 'reschedule', { newSlotId: target.id }),
      act(second.id, 'reschedule', { newSlotId: target.id }),
    ]);

    expect(successes(results)).toBe(1);
    expect(results.find(r => r.status !== 200)?.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect(
      await prisma.booking.count({ where: { slotId: target.id, status: { in: ['RESCHEDULED'] } } }),
    ).toBe(1);
  });

  it('never double-books a slot when a reschedule races a new customer booking', async () => {
    for (let round = 0; round < 4; round += 1) {
      const booking = await makeBooking('APPROVED', { days: 3 + round, hour: 8 });
      const target = await freeSlot(10 + round, 10);
      const newcomer = await newCustomer();
      await Promise.all([
        act(booking.id, 'reschedule', { newSlotId: target.id }),
        request(app)
          .post('/api/bookings')
          .set('Cookie', authCookie(newcomer))
          .send({ slotId: target.id }),
      ]);

      const holders = await prisma.booking.count({
        where: { slotId: target.id, status: { in: ['PENDING', 'APPROVED', 'RESCHEDULED'] } },
      });
      expect(holders, `round ${round}`).toBe(1);
    }
  });

  it("does not deadlock when reschedules swap or chain between each other's slots", async () => {
    for (let round = 0; round < 5; round += 1) {
      const a = await makeBooking('APPROVED', { days: 3 + round * 3, hour: 8 });
      const b = await makeBooking('APPROVED', { days: 3 + round * 3, hour: 12 });
      const spare = await freeSlot(30 + round, 10);
      const results = await Promise.all([
        act(a.id, 'reschedule', { newSlotId: b.slotId }),
        act(b.id, 'reschedule', { newSlotId: a.slotId }),
        act(a.id, 'reschedule', { newSlotId: spare.id }),
      ]);

      expect(
        results.every(r => r.status !== 500),
        `round ${round}`,
      ).toBe(true);
      for (const slotId of [a.slotId, b.slotId, spare.id]) {
        const holders = await prisma.booking.count({
          where: { slotId, status: { in: ['PENDING', 'APPROVED', 'RESCHEDULED'] } },
        });
        expect(holders).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each([
    ['approve', {}],
    ['reject', { rejectionReason: REASON }],
    ['cancel', { cancellationReason: REASON }],
  ] as [Action, object][])(
    'does not deadlock when a reschedule races a %s of the same booking',
    async (action, body) => {
      for (let round = 0; round < 6; round += 1) {
        const booking = await makeBooking('PENDING', { days: 3 + round, hour: 8 });
        const target = await freeSlot(20 + round, 10);
        const results = await Promise.all([
          act(booking.id, 'reschedule', { newSlotId: target.id }),
          act(booking.id, action, body),
        ]);
        const row = await stored(booking.id);

        expect(
          results.every(r => r.status !== 500),
          `${action} round ${round}`,
        ).toBe(true);
        expect(results.filter(r => r.status === 200)).toHaveLength(row.statusHistory.length);
        let expectedFrom = 'PENDING';
        for (const entry of row.statusHistory) {
          expect(entry.fromStatus).toBe(expectedFrom);
          expectedFrom = entry.toStatus;
        }
        expect(expectedFrom).toBe(row.status);
      }
    },
  );

  it('does not deadlock when a reschedule races the customer being deactivated', async () => {
    for (let round = 0; round < 4; round += 1) {
      const booking = await makeBooking('APPROVED', { days: 3 + round, hour: 8 });
      const target = await freeSlot(12 + round, 10);
      const results = await Promise.all([
        act(booking.id, 'reschedule', { newSlotId: target.id }),
        request(app)
          .patch(`/api/admin/customers/${booking.customerId}/status`)
          .set('Cookie', staffCookie)
          .send({ isActive: false }),
      ]);

      expect(
        results.every(r => r.status !== 500),
        `round ${round}`,
      ).toBe(true);
      const row = await stored(booking.id);
      const holders = await prisma.booking.count({
        where: {
          slotId: { in: [booking.slotId, target.id] },
          status: { in: ['PENDING', 'APPROVED', 'RESCHEDULED'] },
        },
      });
      expect(holders).toBeLessThanOrEqual(1);
      expect(['RESCHEDULED', 'CANCELLED']).toContain(row.status);
    }
  });
});

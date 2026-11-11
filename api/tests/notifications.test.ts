import type { BookingStatus, NotificationType } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import * as mailService from '../src/services/mailService';
import { formatSlotWindow } from '../src/utils/formatSlot';
import { authCookie } from './helpers/auth';
import { createBooking, createCustomer, resetDatabase, seedMinimalData } from './helpers/db';
import { addSlot, utcInstant } from './helpers/slots';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;
let customerCookie: string;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  await prisma.timeSlot.delete({ where: { id: data.slot.id } });
  staffCookie = authCookie(data.staff);
  customerCookie = authCookie(data.customer);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const REASON = 'The vehicle is needed for a press event.';
const staffAct = (id: string, action: string, body: object = {}) =>
  request(app).patch(`/api/admin/bookings/${id}/${action}`).set('Cookie', staffCookie).send(body);
const customerCancel = (id: string, body: object = {}) =>
  request(app).patch(`/api/bookings/${id}/cancel`).set('Cookie', customerCookie).send(body);
const notificationsFor = (userId: string) =>
  prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
const silenceMail = () => vi.spyOn(mailService, 'sendMail').mockResolvedValue();

const makeBooking = async (status: BookingStatus, days = 3, customerId = data.customer.id) => {
  const slot = await addSlot(data, utcInstant(days, 10));
  const booking = await createBooking(customerId, slot.id, status);
  return { id: booking.id, slot, customerId };
};

interface Flow {
  label: string;
  type: NotificationType;
  title: string;
  run: () => Promise<request.Response>;
  expectInMessage: string[];
}

const flows = (): Flow[] => [
  {
    label: 'booking created',
    type: 'BOOKING_CREATED',
    title: 'Test-drive request received',
    run: async () => {
      const slot = await addSlot(data, utcInstant(3, 10));
      return request(app)
        .post('/api/bookings')
        .set('Cookie', customerCookie)
        .send({ slotId: slot.id });
    },
    expectInMessage: ['has been received'],
  },
  {
    label: 'approved by staff',
    type: 'BOOKING_APPROVED',
    title: 'Test drive confirmed',
    run: async () =>
      staffAct((await makeBooking('PENDING')).id, 'approve', { staffNote: 'See you soon' }),
    expectInMessage: ['has been confirmed', 'See you soon'],
  },
  {
    label: 'rejected by staff',
    type: 'BOOKING_REJECTED',
    title: 'Test-drive request declined',
    run: async () =>
      staffAct((await makeBooking('PENDING')).id, 'reject', { rejectionReason: REASON }),
    expectInMessage: ['unable to accommodate', 'press event'],
  },
  {
    label: 'rescheduled by staff',
    type: 'BOOKING_RESCHEDULED',
    title: 'Test drive rescheduled',
    run: async () => {
      const booking = await makeBooking('APPROVED', 3);
      const target = await addSlot(data, utcInstant(6, 14));
      return staffAct(booking.id, 'reschedule', { newSlotId: target.id });
    },
    expectInMessage: ['moved from', '10:00 to 11:00 UTC', '14:00 to 15:00 UTC'],
  },
  {
    label: 'cancelled by staff',
    type: 'BOOKING_CANCELLED',
    title: 'Test drive cancelled',
    run: async () =>
      staffAct((await makeBooking('APPROVED')).id, 'cancel', { cancellationReason: REASON }),
    expectInMessage: ['cancelled by our team', 'press event'],
  },
  {
    label: 'cancelled by the customer',
    type: 'BOOKING_CANCELLED',
    title: 'Test drive cancelled',
    run: async () =>
      customerCancel((await makeBooking('APPROVED')).id, { reason: 'Plans changed' }),
    expectInMessage: ['You have cancelled', 'Plans changed'],
  },
  {
    label: 'completed by staff',
    type: 'BOOKING_COMPLETED',
    title: 'Thank you for visiting',
    run: async () =>
      staffAct((await makeBooking('APPROVED', -2)).id, 'complete', { staffNote: 'Great drive' }),
    expectInMessage: ['Thank you for test driving', 'Great drive'],
  },
];

describe('every status change creates exactly one notification for the booking customer', () => {
  it.each(flows().map(flow => flow.label))('%s', async label => {
    const flow = flows().find(f => f.label === label)!;
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    silenceMail();
    const res = await flow.run();

    expect([200, 201]).toContain(res.status);
    const mine = await notificationsFor(data.customer.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      type: flow.type,
      title: flow.title,
      isRead: false,
      userId: data.customer.id,
    });
    expect(mine[0].bookingId).not.toBeNull();
    expect(mine[0].message).toContain('Porsche 911 Carrera T');
    expect(mine[0].message).toContain('Prestige Mayfair');
    expect(mine[0].message).toMatch(/\d{1,2} \w+ \d{4}, \d\d:\d\d to \d\d:\d\d UTC/);
    for (const fragment of flow.expectInMessage) expect(mine[0].message).toContain(fragment);
    expect(await notificationsFor(data.staff.id)).toHaveLength(0);
    expect(await notificationsFor(other.id)).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('the message contains the exact date and time of the slot', async () => {
    silenceMail();
    const booking = await makeBooking('PENDING', 4);
    await staffAct(booking.id, 'approve');
    const [notification] = await notificationsFor(data.customer.id);

    expect(notification.message).toContain(
      formatSlotWindow(booking.slot.startAt, booking.slot.endAt),
    );
  });

  it('notifies the right customer when staff act on someone else booking', async () => {
    silenceMail();
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const theirs = await makeBooking('PENDING', 4, other.id);
    await staffAct(theirs.id, 'approve');

    expect(await notificationsFor(other.id)).toHaveLength(1);
    expect(await notificationsFor(data.customer.id)).toHaveLength(0);
  });

  it('creates one notification per step through a whole lifecycle', async () => {
    silenceMail();
    const slot = await addSlot(data, utcInstant(3, 10));
    const target = await addSlot(data, utcInstant(5, 10));
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({ slotId: slot.id });
    const id = created.body.data.id;
    await staffAct(id, 'approve');
    await staffAct(id, 'reschedule', { newSlotId: target.id });
    await customerCancel(id);
    const types = (await notificationsFor(data.customer.id)).map(n => n.type);

    expect(types).toEqual([
      'BOOKING_CREATED',
      'BOOKING_APPROVED',
      'BOOKING_RESCHEDULED',
      'BOOKING_CANCELLED',
    ]);
    const history = await prisma.bookingStatusHistory.count({ where: { bookingId: id } });
    expect(history).toBe(types.length);
  });

  it('creates nothing when the action is refused', async () => {
    silenceMail();
    const booking = await makeBooking('REJECTED');
    await staffAct(booking.id, 'approve');
    await staffAct(booking.id, 'cancel', { cancellationReason: REASON });
    await customerCancel(booking.id);

    expect(await prisma.notification.count()).toBe(0);
  });

  describe('customer deactivation cascade', () => {
    it('creates one notification per cancelled booking and tells the customer why', async () => {
      silenceMail();
      await makeBooking('PENDING', 3);
      await makeBooking('APPROVED', 5);
      await makeBooking('RESCHEDULED', 7);
      await makeBooking('COMPLETED', -4);
      const res = await request(app)
        .patch(`/api/admin/customers/${data.customer.id}/status`)
        .set('Cookie', staffCookie)
        .send({ isActive: false });
      const notifications = await notificationsFor(data.customer.id);

      expect(res.body.data.cancelledBookings).toBe(3);
      expect(notifications).toHaveLength(3);
      expect(new Set(notifications.map(n => n.bookingId)).size).toBe(3);
      for (const notification of notifications) {
        expect(notification.type).toBe('BOOKING_CANCELLED');
        expect(notification.message).toContain('cancelled by our team');
        expect(notification.message).toContain('Reason: Account deactivated.');
        expect(notification.message).toContain('Porsche 911 Carrera T');
      }
    });

    it('creates nothing when reactivating or when there is nothing to cancel', async () => {
      silenceMail();
      await request(app)
        .patch(`/api/admin/customers/${data.customer.id}/status`)
        .set('Cookie', staffCookie)
        .send({ isActive: false });
      await request(app)
        .patch(`/api/admin/customers/${data.customer.id}/status`)
        .set('Cookie', staffCookie)
        .send({ isActive: true });

      expect(await prisma.notification.count()).toBe(0);
    });
  });
});

describe('emails', () => {
  const customerEmail = 'customer@example.test';

  it.each(flows().map(flow => flow.label))(
    '%s sends exactly one email to the customer',
    async label => {
      const flow = flows().find(f => f.label === label)!;
      const send = silenceMail();
      await flow.run();

      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0][0];
      expect(mail.to).toBe(customerEmail);
      expect(mail.subject.startsWith(flow.title)).toBe(true);
      expect(mail.subject).toContain('Porsche 911 Carrera T');
      expect(mail.text).toContain('Dear Amelia,');
      expect(mail.html).toContain('PRESTIGE');
      for (const fragment of flow.expectInMessage) {
        expect(mail.text).toContain(fragment);
        expect(mail.html).toContain(fragment.replace(/'/g, '&#39;'));
      }
    },
  );

  it('is awaited after the commit: the response only returns once the email attempt has finished', async () => {
    const booking = await makeBooking('PENDING');
    let visibleAtSend = false;
    let finished = false;
    vi.spyOn(mailService, 'sendMail').mockImplementation(async () => {
      visibleAtSend =
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status ===
        'APPROVED';
      await new Promise(resolve => setTimeout(resolve, 150));
      finished = true;
    });
    const res = await staffAct(booking.id, 'approve');

    expect(res.status).toBe(200);
    expect(visibleAtSend).toBe(true);
    expect(finished).toBe(true);
  });

  it.each(flows().map(flow => flow.label))('a failing email does not break: %s', async label => {
    const flow = flows().find(f => f.label === label)!;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(mailService, 'sendMail').mockRejectedValue(new Error('connection refused'));
    const res = await flow.run();

    expect([200, 201]).toContain(res.status);
    expect(await notificationsFor(data.customer.id)).toHaveLength(1);
    const history = await prisma.bookingStatusHistory.count();
    expect(history).toBeGreaterThanOrEqual(1);
  });

  it('logs the failure, naming the recipient, instead of raising it', async () => {
    const booking = await makeBooking('PENDING');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(mailService, 'sendMail').mockRejectedValue(new Error('connection refused'));
    await staffAct(booking.id, 'approve');

    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain(customerEmail);
  });

  it('sends nothing when the action is refused', async () => {
    const booking = await makeBooking('CANCELLED');
    const send = silenceMail();
    await staffAct(booking.id, 'approve');
    await customerCancel(booking.id);

    expect(send).not.toHaveBeenCalled();
  });

  it('escapes hostile staff text in the HTML version', async () => {
    const booking = await makeBooking('PENDING');
    const send = silenceMail();
    await staffAct(booking.id, 'reject', { rejectionReason: '<script>alert(1)</script> sold' });
    const mail = send.mock.calls[0][0];

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail.text).toContain('<script>alert(1)</script> sold');
  });

  it('sends one email per cancelled booking when a customer is deactivated, even if some fail', async () => {
    await makeBooking('PENDING', 3);
    await makeBooking('APPROVED', 5);
    const send = vi
      .spyOn(mailService, 'sendMail')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app)
      .patch(`/api/admin/customers/${data.customer.id}/status`)
      .set('Cookie', staffCookie)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.cancelledBookings).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(await prisma.booking.count({ where: { status: 'CANCELLED' } })).toBe(2);
    expect(await notificationsFor(data.customer.id)).toHaveLength(2);
  });
});

describe('GET /api/notifications', () => {
  let other: Awaited<ReturnType<typeof createCustomer>>;
  const seedNotifications = async () => {
    other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const base = Date.now() - 10 * 3_600_000;
    const row = (userId: string, index: number, isRead: boolean) => ({
      userId,
      type: 'BOOKING_APPROVED' as const,
      title: `Notice ${index}`,
      message: `Message ${index}`,
      isRead,
      createdAt: new Date(base + index * 3_600_000),
    });
    await prisma.notification.createMany({
      data: [
        row(data.customer.id, 1, true),
        row(data.customer.id, 2, false),
        row(data.customer.id, 3, true),
        row(data.customer.id, 4, false),
        row(data.customer.id, 5, false),
        row(other.id, 6, false),
        row(other.id, 7, false),
      ],
    });
  };
  const get = (url: string, cookie = customerCookie) => request(app).get(url).set('Cookie', cookie);
  const titles = (res: request.Response): string[] =>
    res.body.data.items.map((n: { title: string }) => n.title);

  beforeEach(seedNotifications);

  it('lists the signed-in user own notifications, newest first, and nobody else', async () => {
    const res = await get('/api/notifications');

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Notice 5', 'Notice 4', 'Notice 3', 'Notice 2', 'Notice 1']);
    expect(res.body.data).toMatchObject({ total: 5, page: 1, pageSize: 10, totalPages: 1 });
    expect(JSON.stringify(res.body)).not.toContain('Notice 6');
    expect(Object.keys(res.body.data.items[0]).sort()).toEqual(
      ['bookingId', 'createdAt', 'id', 'isRead', 'message', 'title', 'type'].sort(),
    );
  });

  it('filters to unread only', async () => {
    const res = await get('/api/notifications?unreadOnly=true');

    expect(titles(res)).toEqual(['Notice 5', 'Notice 4', 'Notice 2']);
    expect(res.body.data.total).toBe(3);
    expect((await get('/api/notifications?unreadOnly=false')).body.data.total).toBe(5);
  });

  it('paginates', async () => {
    const first = await get('/api/notifications?pageSize=2&page=1');
    const second = await get('/api/notifications?pageSize=2&page=2');
    const third = await get('/api/notifications?pageSize=2&page=3');

    expect(first.body.data).toMatchObject({ total: 5, totalPages: 3 });
    expect([...titles(first), ...titles(second), ...titles(third)]).toEqual([
      'Notice 5',
      'Notice 4',
      'Notice 3',
      'Notice 2',
      'Notice 1',
    ]);
    expect((await get('/api/notifications?page=9')).body.data.items).toEqual([]);
  });

  it('returns the unread count for the signed-in user only', async () => {
    expect((await get('/api/notifications/unread-count')).body.data).toEqual({ count: 3 });
    expect((await get('/api/notifications/unread-count', authCookie(other))).body.data).toEqual({
      count: 2,
    });
    expect((await get('/api/notifications/unread-count', staffCookie)).body.data).toEqual({
      count: 0,
    });
  });

  it('works for staff, who simply have none of their own', async () => {
    const res = await get('/api/notifications', staffCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ items: [], total: 0 });
  });

  it.each([
    'unreadOnly=maybe',
    'page=0',
    'pageSize=51',
    'pageSize=0',
    'userId=abc',
    'type=BOOKING_CREATED',
  ])('rejects %s', async query => {
    expect((await get(`/api/notifications?${query}`)).status).toBe(422);
  });

  it('requires authentication on every endpoint', async () => {
    const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';
    const results = await Promise.all([
      request(app).get('/api/notifications'),
      request(app).get('/api/notifications/unread-count'),
      request(app).patch(`/api/notifications/${id}/read`),
      request(app).patch('/api/notifications/read-all'),
    ]);

    expect(results.map(r => r.status)).toEqual([401, 401, 401, 401]);
  });
});

describe('marking notifications as read', () => {
  let mine: { id: string }[];
  let theirs: { id: string }[];
  let other: Awaited<ReturnType<typeof createCustomer>>;
  const patch = (url: string, cookie = customerCookie) =>
    request(app).patch(url).set('Cookie', cookie);

  beforeEach(async () => {
    other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const make = (userId: string, title: string) =>
      prisma.notification.create({
        data: { userId, type: 'BOOKING_APPROVED', title, message: `${title} message` },
      });
    mine = [
      await make(data.customer.id, 'Mine 1'),
      await make(data.customer.id, 'Mine 2'),
      await make(data.customer.id, 'Mine 3'),
    ];
    theirs = [await make(other.id, 'Theirs 1'), await make(other.id, 'Theirs 2')];
  });

  const unread = async (userId: string): Promise<number> =>
    prisma.notification.count({ where: { userId, isRead: false } });

  it('marks one notification as read and reduces the unread count', async () => {
    const res = await patch(`/api/notifications/${mine[0].id}/read`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: mine[0].id, isRead: true, title: 'Mine 1' });
    expect(await unread(data.customer.id)).toBe(2);
    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', customerCookie);
    expect(count.body.data.count).toBe(2);
    const unreadOnly = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Cookie', customerCookie);
    expect(unreadOnly.body.data.total).toBe(2);
  });

  it('is idempotent', async () => {
    await patch(`/api/notifications/${mine[0].id}/read`);
    const again = await patch(`/api/notifications/${mine[0].id}/read`);

    expect(again.status).toBe(200);
    expect(again.body.data.isRead).toBe(true);
    expect(await unread(data.customer.id)).toBe(2);
  });

  it("read-all marks every one of the user own notifications and nobody else's", async () => {
    const res = await patch('/api/notifications/read-all');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 3 });
    expect(await unread(data.customer.id)).toBe(0);
    expect(await unread(other.id)).toBe(2);
  });

  it('read-all is harmless when nothing is unread', async () => {
    await patch('/api/notifications/read-all');
    const again = await patch('/api/notifications/read-all');

    expect(again.body.data).toEqual({ updated: 0 });
  });

  it('is not confused with the :id route', async () => {
    expect((await patch('/api/notifications/read-all')).status).toBe(200);
    expect((await patch('/api/notifications/read-all/read')).status).toBe(422);
  });

  describe("another user's notifications", () => {
    it('cannot be read, and the response is the same as for a notification that does not exist', async () => {
      const res = await patch(`/api/notifications/${theirs[0].id}/read`);
      const unknown = await patch('/api/notifications/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11/read');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body).toEqual(unknown.body);
      expect(await unread(other.id)).toBe(2);
    });

    it('are never listed or counted', async () => {
      const list = await request(app).get('/api/notifications').set('Cookie', customerCookie);

      expect(list.body.data.total).toBe(3);
      expect(JSON.stringify(list.body)).not.toContain('Theirs');
    });

    it('cannot be marked read by staff either', async () => {
      const res = await patch(`/api/notifications/${mine[0].id}/read`, staffCookie);

      expect(res.status).toBe(404);
      expect(await unread(data.customer.id)).toBe(3);
    });
  });

  it('rejects a malformed id', async () => {
    expect((await patch('/api/notifications/nope/read')).status).toBe(422);
  });
});

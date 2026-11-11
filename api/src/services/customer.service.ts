import type { BookingStatus, Prisma } from '@prisma/client';
import { escapeLike } from '../utils/likeEscape';
import { prisma } from '../config/prisma';
import type { CustomerListQuery } from '../validators/customer.validators';
import { AppError } from '../utils/AppError';
import { ACTIVE_BOOKING_STATUSES } from '../utils/bookingStatus';
import { lockUser } from '../utils/locks';
import { Page, buildPage, toSkipTake } from '../utils/pagination';
import { SAFE_USER_SELECT, SafeUser } from '../utils/safeUser';
import { loadBookingForUpdate } from './bookingLoader';
import { TRANSACTION_OPTIONS, applyTransition } from './bookingTransition';
import { PendingNotification, deliverEmails } from './notificationService';

const DEACTIVATION_CANCEL_REASON = 'Account deactivated';
const RECENT_BOOKINGS_LIMIT = 50;

export type CustomerListItem = SafeUser & { bookingCount: number; lastBookingAt: Date | null };

const notFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Customer not found');

const searchFilter = (q: string | undefined): Prisma.UserWhereInput[] =>
  (q?.split(/\s+/) ?? []).filter(Boolean).map(term => ({
    OR: [
      { firstName: { contains: escapeLike(term), mode: 'insensitive' } },
      { lastName: { contains: escapeLike(term), mode: 'insensitive' } },
      { email: { contains: escapeLike(term), mode: 'insensitive' } },
      { phone: { contains: escapeLike(term), mode: 'insensitive' } },
    ],
  }));

const orderByFor = (
  sortBy: CustomerListQuery['sortBy'],
  order: CustomerListQuery['sortOrder'],
): Prisma.UserOrderByWithRelationInput[] => {
  const primary: Prisma.UserOrderByWithRelationInput[] =
    sortBy === 'bookingCount'
      ? [{ bookings: { _count: order } }]
      : sortBy === 'lastName'
        ? [{ lastName: order }, { firstName: order }]
        : [{ [sortBy]: order }];
  return [...primary, { id: 'asc' }];
};

const bookingStats = async (customerIds: string[]) => {
  const groups = await prisma.booking.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  return new Map(groups.map(group => [group.customerId, group]));
};

export const listCustomers = async (query: CustomerListQuery): Promise<Page<CustomerListItem>> => {
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    AND: searchFilter(query.q),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: orderByFor(query.sortBy, query.sortOrder),
      ...toSkipTake(query),
    }),
    prisma.user.count({ where }),
  ]);
  const stats = await bookingStats(users.map(user => user.id));
  const items = users.map(user => ({
    ...user,
    bookingCount: stats.get(user.id)?._count._all ?? 0,
    lastBookingAt: stats.get(user.id)?._max.createdAt ?? null,
  }));
  return buildPage(items, total, query);
};

export const getCustomerDetail = async (customerId: string) => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: SAFE_USER_SELECT,
  });
  if (!customer) throw notFound();

  const [statusGroups, bookings] = await Promise.all([
    prisma.booking.groupBy({ by: ['status'], where: { customerId }, _count: { _all: true } }),
    prisma.booking.findMany({
      where: { customerId },
      orderBy: { slot: { startAt: 'desc' } },
      take: RECENT_BOOKINGS_LIMIT,
      select: {
        id: true,
        status: true,
        createdAt: true,
        slot: {
          select: {
            startAt: true,
            endAt: true,
            vehicle: { select: { id: true, manufacturer: true, model: true } },
            dealership: { select: { id: true, name: true, city: true } },
          },
        },
      },
    }),
  ]);

  const byStatus = Object.fromEntries(
    statusGroups.map(group => [group.status, group._count._all]),
  ) as Partial<Record<BookingStatus, number>>;
  const total = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
  return { customer, summary: { total, byStatus }, bookings };
};

const cancelFutureActiveBookings = async (
  tx: Prisma.TransactionClient,
  customerId: string,
  staffId: string,
): Promise<PendingNotification[]> => {
  const candidates = await tx.booking.findMany({
    where: {
      customerId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      slot: { startAt: { gt: new Date() } },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const pending: PendingNotification[] = [];
  for (const { id } of candidates) {
    const booking = await loadBookingForUpdate(tx, id);
    const stillCancellable =
      ACTIVE_BOOKING_STATUSES.includes(booking.status) && booking.slot.startAt > new Date();
    if (!stillCancellable) continue;
    const outcome = await applyTransition(tx, booking, staffId, {
      to: 'CANCELLED',
      action: 'CANCELLED',
      actor: 'STAFF',
      reason: DEACTIVATION_CANCEL_REASON,
      data: { cancellationReason: DEACTIVATION_CANCEL_REASON, cancelledBy: 'STAFF' },
    });
    pending.push(outcome.pending);
  }
  return pending;
};

export const setCustomerStatus = async (customerId: string, isActive: boolean, staffId: string) => {
  const result = await prisma.$transaction(async tx => {
    await lockUser(tx, customerId);
    const current = await tx.user.findFirst({
      where: { id: customerId, role: 'CUSTOMER' },
      select: SAFE_USER_SELECT,
    });
    if (!current) throw notFound();
    if (current.isActive === isActive) {
      return { customer: current, pending: [] as PendingNotification[] };
    }
    const customer = await tx.user.update({
      where: { id: customerId },
      data: { isActive },
      select: SAFE_USER_SELECT,
    });
    const pending = isActive ? [] : await cancelFutureActiveBookings(tx, customerId, staffId);
    return { customer, pending };
  }, TRANSACTION_OPTIONS);
  await deliverEmails(result.pending);
  return { customer: result.customer, cancelledBookings: result.pending.length };
};

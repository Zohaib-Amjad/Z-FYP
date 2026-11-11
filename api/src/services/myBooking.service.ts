import type { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { CancelMyBookingInput, MyBookingsQuery } from '../validators/myBooking.validators';
import { MY_BOOKING_VIEWS, MyBookingView } from '../validators/myBooking.validators';
import { AppError } from '../utils/AppError';
import { buildPage, toSkipTake } from '../utils/pagination';
import { applyTransition, onLockedBooking } from './bookingTransition';
import { assertCancellable, getCancellationEligibility } from './cancellationPolicy';

const MY_BOOKING_SELECT = {
  id: true,
  status: true,
  customerNote: true,
  staffNote: true,
  rejectionReason: true,
  cancellationReason: true,
  cancelledBy: true,
  approvedAt: true,
  completedAt: true,
  createdAt: true,
  slot: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      vehicle: {
        select: {
          id: true,
          manufacturer: true,
          model: true,
          year: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
        },
      },
      dealership: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
          openingHours: true,
        },
      },
    },
  },
} satisfies Prisma.BookingSelect;

type MyBookingRow = Prisma.BookingGetPayload<{ select: typeof MY_BOOKING_SELECT }>;

const ASCENDING_VIEWS: ReadonlySet<MyBookingView> = new Set(['pending', 'upcoming']);
const FUTURE_CONFIRMED: BookingStatus[] = ['APPROVED', 'RESCHEDULED'];
const WITHDRAWN: BookingStatus[] = ['CANCELLED', 'REJECTED'];

const viewFilter = (view: MyBookingView, now: Date): Prisma.BookingWhereInput => {
  switch (view) {
    case 'pending':
      return { status: 'PENDING' };
    case 'upcoming':
      return { status: { in: FUTURE_CONFIRMED }, slot: { startAt: { gt: now } } };
    case 'completed':
      return { status: 'COMPLETED' };
    case 'cancelled':
      return { status: { in: WITHDRAWN } };
    case 'previous':
      return { slot: { startAt: { lte: now } } };
    case 'all':
      return {};
  }
};

const toMyBooking = ({ slot, ...booking }: MyBookingRow, now: Date) => {
  const { vehicle, dealership, ...times } = slot;
  const { images, ...vehicleFields } = vehicle;
  const eligibility = getCancellationEligibility(
    { status: booking.status, slotStartAt: times.startAt },
    now,
  );
  return {
    ...booking,
    slotId: times.id,
    startAt: times.startAt,
    endAt: times.endAt,
    vehicle: {
      ...vehicleFields,
      name: `${vehicle.manufacturer} ${vehicle.model}`,
      primaryImage: images.at(0) ?? null,
    },
    dealership,
    canCancel: eligibility.canCancel,
    cancelBlockedReason: eligibility.canCancel ? null : eligibility.reason,
  };
};

export const listMyBookings = async (customerId: string, query: MyBookingsQuery) => {
  const now = new Date();
  const where: Prisma.BookingWhereInput = { customerId, ...viewFilter(query.view, now) };
  const direction = ASCENDING_VIEWS.has(query.view) ? 'asc' : 'desc';
  const [rows, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      select: MY_BOOKING_SELECT,
      orderBy: [{ slot: { startAt: direction } }, { id: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.booking.count({ where }),
  ]);
  return buildPage(
    rows.map(row => toMyBooking(row, now)),
    total,
    query,
  );
};

export const getMyBookingCounts = async (customerId: string) => {
  const now = new Date();
  const counts = await prisma.$transaction(
    MY_BOOKING_VIEWS.map(view =>
      prisma.booking.count({ where: { customerId, ...viewFilter(view, now) } }),
    ),
  );
  return Object.fromEntries(MY_BOOKING_VIEWS.map((view, index) => [view, counts[index]])) as Record<
    MyBookingView,
    number
  >;
};

const loadTimeline = async (bookingId: string, customerId: string) => {
  const history = await prisma.bookingStatusHistory.findMany({
    where: { bookingId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      action: true,
      note: true,
      oldSlotId: true,
      newSlotId: true,
      createdAt: true,
      changedBy: { select: { id: true, role: true } },
    },
  });
  const slotIds = [
    ...new Set(history.flatMap(entry => [entry.oldSlotId, entry.newSlotId]).filter(Boolean)),
  ] as string[];
  const slots = await prisma.timeSlot.findMany({
    where: { id: { in: slotIds } },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      dealership: { select: { id: true, name: true } },
    },
  });
  const slotById = new Map(slots.map(slot => [slot.id, slot]));
  return history.map(({ oldSlotId, newSlotId, changedBy, ...entry }) => ({
    ...entry,
    oldSlot: oldSlotId ? (slotById.get(oldSlotId) ?? null) : null,
    newSlot: newSlotId ? (slotById.get(newSlotId) ?? null) : null,
    changedBy:
      changedBy.id === customerId
        ? { role: changedBy.role, label: 'You' }
        : { role: changedBy.role, label: 'Prestige team' },
  }));
};

export const getMyBooking = async (customerId: string, bookingId: string) => {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: MY_BOOKING_SELECT,
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  return {
    ...toMyBooking(row, new Date()),
    statusHistory: await loadTimeline(bookingId, customerId),
  };
};

export const cancelMyBooking = async (
  customerId: string,
  bookingId: string,
  input: CancelMyBookingInput,
) => {
  await onLockedBooking(bookingId, (tx, booking) => {
    if (booking.customer.id !== customerId)
      throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    assertCancellable({ status: booking.status, slotStartAt: booking.slot.startAt });
    return applyTransition(tx, booking, customerId, {
      to: 'CANCELLED',
      action: 'CANCELLED',
      actor: 'CUSTOMER',
      reason: input.reason || undefined,
      data: { cancellationReason: input.reason || null, cancelledBy: 'CUSTOMER' },
    });
  });
  return getMyBooking(customerId, bookingId);
};

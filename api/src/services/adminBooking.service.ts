import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AdminBookingsQuery } from '../validators/adminBooking.validators';
import { AppError } from '../utils/AppError';
import { BOOKING_SELECT, BookingRow, toBookingDto } from '../utils/bookingDto';
import { escapeLike } from '../utils/likeEscape';
import { buildPage, toSkipTake } from '../utils/pagination';

const fullName = (person: { firstName: string; lastName: string }): string =>
  `${person.firstName} ${person.lastName}`;

export const toAdminBookingItem = (row: BookingRow) => {
  const dto = toBookingDto(row);
  return {
    ...dto,
    customer: { ...dto.customer, name: fullName(dto.customer) },
    vehicle: { ...dto.vehicle, name: `${dto.vehicle.manufacturer} ${dto.vehicle.model}` },
  };
};

const textClauses = (q: string | undefined): Prisma.BookingWhereInput[] =>
  (q?.split(/\s+/) ?? [])
    .filter(Boolean)
    .map(escapeLike)
    .map(term => ({
      OR: [
        { customer: { firstName: { contains: term, mode: 'insensitive' } } },
        { customer: { lastName: { contains: term, mode: 'insensitive' } } },
        { customer: { email: { contains: term, mode: 'insensitive' } } },
        { customer: { phone: { contains: term, mode: 'insensitive' } } },
        { slot: { vehicle: { manufacturer: { contains: term, mode: 'insensitive' } } } },
        { slot: { vehicle: { model: { contains: term, mode: 'insensitive' } } } },
      ],
    }));

const slotFilter = (query: AdminBookingsQuery, now: Date): Prisma.TimeSlotWhereInput => ({
  ...(query.dealershipId ? { dealershipId: query.dealershipId } : {}),
  ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
  ...(query.dateFrom || query.dateTo || query.upcomingOnly
    ? {
        startAt: {
          ...(query.dateFrom ? { gte: query.dateFrom } : {}),
          ...(query.dateTo ? { lte: query.dateTo } : {}),
          ...(query.upcomingOnly ? { gt: now } : {}),
        },
      }
    : {}),
});

const buildWhere = (query: AdminBookingsQuery, now: Date): Prisma.BookingWhereInput => {
  const slot = slotFilter(query, now);
  return {
    ...(query.status ? { status: { in: query.status } } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.createdFrom || query.createdTo
      ? { createdAt: { gte: query.createdFrom, lte: query.createdTo } }
      : {}),
    ...(Object.keys(slot).length > 0 ? { slot } : {}),
    AND: textClauses(query.q),
  };
};

const orderByFor = (sort: AdminBookingsQuery['sort']): Prisma.BookingOrderByWithRelationInput[] =>
  sort === 'createdDesc'
    ? [{ createdAt: 'desc' }, { id: 'asc' }]
    : [{ slot: { startAt: sort === 'slotStartAsc' ? 'asc' : 'desc' } }, { id: 'asc' }];

export const listAdminBookings = async (query: AdminBookingsQuery) => {
  const where = buildWhere(query, new Date());
  const [rows, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      select: BOOKING_SELECT,
      orderBy: orderByFor(query.sort),
      ...toSkipTake(query),
    }),
    prisma.booking.count({ where }),
  ]);
  return buildPage(rows.map(toAdminBookingItem), total, query);
};

const DETAIL_SELECT = {
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
  updatedAt: true,
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      drivingLicenseNumber: true,
      isActive: true,
      createdAt: true,
    },
  },
  slot: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      isActive: true,
      vehicle: {
        select: {
          id: true,
          manufacturer: true,
          model: true,
          year: true,
          vehicleType: true,
          fuelType: true,
          transmission: true,
          color: true,
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
          email: true,
          openingHours: true,
        },
      },
    },
  },
} satisfies Prisma.BookingSelect;

const loadTimeline = async (bookingId: string) => {
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
      changedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
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
    changedBy: { id: changedBy.id, name: fullName(changedBy), role: changedBy.role },
  }));
};

export const getAdminBooking = async (bookingId: string) => {
  const row = await prisma.booking.findUnique({ where: { id: bookingId }, select: DETAIL_SELECT });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const { customer, slot, ...booking } = row;
  const { vehicle, dealership, ...slotFields } = slot;
  const { images, ...vehicleFields } = vehicle;
  return {
    ...booking,
    customer: { ...customer, name: fullName(customer) },
    slot: slotFields,
    vehicle: {
      ...vehicleFields,
      name: `${vehicle.manufacturer} ${vehicle.model}`,
      primaryImage: images.at(0) ?? null,
    },
    dealership,
    statusHistory: await loadTimeline(bookingId),
  };
};

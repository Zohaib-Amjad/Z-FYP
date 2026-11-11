import type { Prisma } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from './bookingStatus';

export const availableSlotWhere = (now: Date = new Date()): Prisma.TimeSlotWhereInput => ({
  isActive: true,
  startAt: { gt: now },
  bookings: { none: { status: { in: ACTIVE_BOOKING_STATUSES } } },
  dealership: { isActive: true },
  vehicle: { isActive: true },
  dealershipVehicle: { isAvailable: true },
});

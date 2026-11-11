import type { BookingStatus } from '@prisma/client';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'APPROVED', 'RESCHEDULED'];

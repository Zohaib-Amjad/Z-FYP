import type { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { BOOKING_SELECT, BookingRow } from '../utils/bookingDto';
import { lockBooking } from '../utils/locks';

export const loadBookingForUpdate = async (
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<BookingRow> => {
  await lockBooking(tx, bookingId);
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: BOOKING_SELECT });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  return booking;
};

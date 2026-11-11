import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { CreateBookingInput } from '../validators/booking.validators';
import { BOOKING_SELECT, toBookingDto } from '../utils/bookingDto';
import { lockUser } from '../utils/locks';
import { recordHistory } from './bookingHistory.service';
import {
  BookableSlot,
  assertCustomerActive,
  assertNoCustomerOverlap,
  assertSlotBookable,
  assertSlotFree,
  assertUnderBookingLimit,
  loadSlotForBooking,
  translateBookingError,
} from './bookingRules';
import { PendingNotification, deliverEmails, notify } from './notificationService';

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const insertBooking = async (
  tx: Prisma.TransactionClient,
  customerId: string,
  slot: BookableSlot,
  input: CreateBookingInput,
) => {
  const row = await tx.booking.create({
    data: { customerId, slotId: slot.id, customerNote: input.customerNote || null },
    select: BOOKING_SELECT,
  });
  const booking = toBookingDto(row);
  await recordHistory(tx, {
    bookingId: booking.id,
    fromStatus: null,
    toStatus: 'PENDING',
    action: 'CREATED',
    note: 'Test-drive request submitted',
    changedById: customerId,
  });
  const pending = await notify(tx, customerId, booking.id, 'BOOKING_CREATED', { booking });
  return { booking, pending };
};

export const createBooking = async (customerId: string, input: CreateBookingInput) => {
  let created: { booking: ReturnType<typeof toBookingDto>; pending: PendingNotification };
  try {
    created = await prisma.$transaction(async tx => {
      await lockUser(tx, customerId);
      await assertCustomerActive(tx, customerId);
      const slot = await loadSlotForBooking(tx, input.slotId);
      assertSlotBookable(slot, new Date());
      await assertSlotFree(tx, slot.id);
      await assertNoCustomerOverlap(tx, customerId, slot);
      await assertUnderBookingLimit(tx, customerId);
      return insertBooking(tx, customerId, slot, input);
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    throw translateBookingError(error);
  }
  await deliverEmails([created.pending]);
  return created.booking;
};

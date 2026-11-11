import type { BookingStatus, NotificationType, Prisma } from '@prisma/client';
import { audit } from '../utils/audit';
import { prisma } from '../config/prisma';
import { BOOKING_SELECT, BookingRow, toBookingDto } from '../utils/bookingDto';
import { loadBookingForUpdate } from './bookingLoader';
import { recordHistory } from './bookingHistory.service';
import { assertTransition } from './bookingStateMachine';
import { PendingNotification, deliverEmails, notify } from './notificationService';
import { Actor, PreviousSlot } from './notificationTemplates';

export type Tx = Prisma.TransactionClient;

export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

type StatusAction = 'APPROVED' | 'REJECTED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';

const NOTIFICATION_TYPES: Record<StatusAction, NotificationType> = {
  APPROVED: 'BOOKING_APPROVED',
  REJECTED: 'BOOKING_REJECTED',
  RESCHEDULED: 'BOOKING_RESCHEDULED',
  CANCELLED: 'BOOKING_CANCELLED',
  COMPLETED: 'BOOKING_COMPLETED',
};

const DEFAULT_HISTORY_NOTES: Record<StatusAction, string> = {
  APPROVED: 'Booking approved',
  REJECTED: 'Booking rejected',
  RESCHEDULED: 'Booking rescheduled',
  CANCELLED: 'Booking cancelled',
  COMPLETED: 'Test drive completed',
};

export interface Transition {
  to: BookingStatus;
  action: StatusAction;
  actor: Actor;
  data: Prisma.BookingUncheckedUpdateInput;
  reason?: string;
  note?: string;
  oldSlotId?: string;
  newSlotId?: string;
  previousSlot?: PreviousSlot;
}

export interface Outcome {
  dto: ReturnType<typeof toBookingDto>;
  pending: PendingNotification;
}

export const applyTransition = async (
  tx: Tx,
  current: BookingRow,
  actorId: string,
  transition: Transition,
): Promise<Outcome> => {
  assertTransition(current.status, transition.to);
  const updated = await tx.booking.update({
    where: { id: current.id },
    data: { status: transition.to, ...transition.data },
    select: BOOKING_SELECT,
  });
  const dto = toBookingDto(updated);
  audit('booking.transition', {
    bookingId: current.id,
    from: current.status,
    to: transition.to,
    action: transition.action,
    actor: transition.actor,
    actorId,
  });
  await recordHistory(tx, {
    bookingId: current.id,
    fromStatus: current.status,
    toStatus: transition.to,
    action: transition.action,
    note: transition.note ?? transition.reason ?? DEFAULT_HISTORY_NOTES[transition.action],
    oldSlotId: transition.oldSlotId,
    newSlotId: transition.newSlotId,
    changedById: actorId,
  });
  const pending = await notify(
    tx,
    dto.customer.id,
    current.id,
    NOTIFICATION_TYPES[transition.action],
    {
      booking: dto,
      actor: transition.actor,
      reason: transition.reason,
      note: transition.note,
      previousSlot: transition.previousSlot,
    },
  );
  return { dto, pending };
};

export const deliver = async ({ dto, pending }: Outcome) => {
  await deliverEmails([pending]);
  return dto;
};

export const onLockedBooking = async (
  bookingId: string,
  work: (tx: Tx, booking: BookingRow) => Promise<Outcome>,
) =>
  deliver(
    await prisma.$transaction(
      async tx => work(tx, await loadBookingForUpdate(tx, bookingId)),
      TRANSACTION_OPTIONS,
    ),
  );

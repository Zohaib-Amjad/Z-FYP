import type { BookingStatus, Prisma } from '@prisma/client';

export interface StatusChange {
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  action: string;
  changedById: string;
  note?: string;
  oldSlotId?: string;
  newSlotId?: string;
}

export const recordHistory = (
  tx: Prisma.TransactionClient,
  change: StatusChange,
): Promise<unknown> =>
  tx.bookingStatusHistory.create({
    data: {
      bookingId: change.bookingId,
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      action: change.action,
      note: change.note ?? null,
      oldSlotId: change.oldSlotId ?? null,
      newSlotId: change.newSlotId ?? null,
      changedById: change.changedById,
    },
  });

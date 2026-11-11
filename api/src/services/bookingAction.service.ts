import { prisma } from '../config/prisma';
import type {
  ApproveInput,
  CancelInput,
  CompleteInput,
  RejectInput,
  RescheduleInput,
} from '../validators/bookingAction.validators';
import { AppError } from '../utils/AppError';
import type { BookingRow } from '../utils/bookingDto';
import { formatSlotWindow } from '../utils/formatSlot';
import { lockUser } from '../utils/locks';
import { loadBookingForUpdate } from './bookingLoader';
import {
  assertNoCustomerOverlap,
  assertSlotBookable,
  assertSlotFree,
  loadSlotForBooking,
  translateBookingError,
} from './bookingRules';
import { assertTransition } from './bookingStateMachine';
import {
  Outcome,
  TRANSACTION_OPTIONS,
  Tx,
  applyTransition,
  deliver,
  onLockedBooking,
} from './bookingTransition';
import { validationError } from './slotRules';

const noteData = (note: string | null | undefined) => (note ? { staffNote: note } : {});

export const approveBooking = (bookingId: string, staffId: string, input: ApproveInput) =>
  onLockedBooking(bookingId, (tx, booking) =>
    applyTransition(tx, booking, staffId, {
      to: 'APPROVED',
      action: 'APPROVED',
      actor: 'STAFF',
      note: input.staffNote || undefined,
      data: { approvedAt: new Date(), ...noteData(input.staffNote) },
    }),
  );

export const rejectBooking = (bookingId: string, staffId: string, input: RejectInput) =>
  onLockedBooking(bookingId, (tx, booking) =>
    applyTransition(tx, booking, staffId, {
      to: 'REJECTED',
      action: 'REJECTED',
      actor: 'STAFF',
      reason: input.rejectionReason,
      data: { rejectionReason: input.rejectionReason },
    }),
  );

export const cancelBookingByStaff = (bookingId: string, staffId: string, input: CancelInput) =>
  onLockedBooking(bookingId, (tx, booking) =>
    applyTransition(tx, booking, staffId, {
      to: 'CANCELLED',
      action: 'CANCELLED',
      actor: 'STAFF',
      reason: input.cancellationReason,
      data: { cancellationReason: input.cancellationReason, cancelledBy: 'STAFF' },
    }),
  );

export const completeBooking = (bookingId: string, staffId: string, input: CompleteInput) =>
  onLockedBooking(bookingId, (tx, booking) => {
    assertTransition(booking.status, 'COMPLETED');
    if (booking.slot.startAt > new Date()) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `A booking cannot be completed before its test drive has started (${formatSlotWindow(booking.slot.startAt, booking.slot.endAt)})`,
      );
    }
    return applyTransition(tx, booking, staffId, {
      to: 'COMPLETED',
      action: 'COMPLETED',
      actor: 'STAFF',
      note: input.staffNote || undefined,
      data: { completedAt: new Date(), ...noteData(input.staffNote) },
    });
  });

const assertSameVehicle = (booking: BookingRow, targetVehicleId: string, targetSlotId: string) => {
  if (targetSlotId === booking.slot.id) {
    throw validationError([
      { field: 'newSlotId', message: 'Choose a slot other than the current one' },
    ]);
  }
  if (targetVehicleId !== booking.slot.vehicle.id) {
    throw validationError([
      { field: 'newSlotId', message: 'The new slot must be for the same vehicle as the booking' },
    ]);
  }
};

const rescheduleInTransaction = async (
  tx: Tx,
  customerId: string,
  bookingId: string,
  staffId: string,
  input: RescheduleInput,
): Promise<Outcome> => {
  await lockUser(tx, customerId);
  const current = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { slotId: true },
  });
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const target = await loadSlotForBooking(tx, input.newSlotId, [current.slotId]);
  const booking = await loadBookingForUpdate(tx, bookingId);
  assertTransition(booking.status, 'RESCHEDULED');
  assertSameVehicle(booking, target.vehicleId, target.id);
  assertSlotBookable(target, new Date());
  await assertSlotFree(tx, target.id);
  await assertNoCustomerOverlap(tx, customerId, target, bookingId);
  return applyTransition(tx, booking, staffId, {
    to: 'RESCHEDULED',
    action: 'RESCHEDULED',
    actor: 'STAFF',
    note: input.note || undefined,
    data: { slotId: target.id, ...noteData(input.note) },
    oldSlotId: booking.slot.id,
    newSlotId: target.id,
    previousSlot: {
      startAt: booking.slot.startAt,
      endAt: booking.slot.endAt,
      dealershipName: booking.slot.dealership.name,
    },
  });
};

export const rescheduleBooking = async (
  bookingId: string,
  staffId: string,
  input: RescheduleInput,
) => {
  const reference = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { customerId: true },
  });
  if (!reference) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  try {
    const outcome = await prisma.$transaction(
      tx => rescheduleInTransaction(tx, reference.customerId, bookingId, staffId, input),
      TRANSACTION_OPTIONS,
    );
    return deliver(outcome);
  } catch (error) {
    throw translateBookingError(error);
  }
};

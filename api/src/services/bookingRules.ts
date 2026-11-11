import type { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { ACTIVE_BOOKING_STATUSES } from '../utils/bookingStatus';
import { formatSlotWindow } from '../utils/formatSlot';
import { lockDealershipShared, lockSlot, lockVehicleShared } from '../utils/locks';
import { isUniqueViolation } from '../utils/prismaErrors';

type Tx = Prisma.TransactionClient;

const slotUnavailable = (): AppError =>
  new AppError(
    409,
    'SLOT_UNAVAILABLE',
    'This time slot is no longer available. Please choose another slot',
  );

export const translateBookingError = (error: unknown): unknown => {
  const isActiveSlotIndex =
    error instanceof Error && /one_active_booking_per_slot|23505/.test(error.message);
  return isUniqueViolation(error) || isActiveSlotIndex ? slotUnavailable() : error;
};

export const assertCustomerActive = async (tx: Tx, customerId: string): Promise<void> => {
  const customer = await tx.user.findUnique({
    where: { id: customerId },
    select: { isActive: true },
  });
  if (!customer?.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated');
  }
};

export const loadSlotForBooking = async (
  tx: Tx,
  slotId: string,
  alsoLockSlotIds: string[] = [],
) => {
  const reference = await tx.timeSlot.findUnique({
    where: { id: slotId },
    select: { vehicleId: true, dealershipId: true },
  });
  if (!reference) throw new AppError(404, 'NOT_FOUND', 'Time slot not found');
  await lockVehicleShared(tx, reference.vehicleId);
  await lockDealershipShared(tx, reference.dealershipId);
  for (const id of [...new Set([slotId, ...alsoLockSlotIds])].sort()) {
    await lockSlot(tx, id);
  }
  const slot = await tx.timeSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      vehicleId: true,
      startAt: true,
      endAt: true,
      isActive: true,
      vehicle: { select: { manufacturer: true, model: true, isActive: true } },
      dealership: { select: { name: true, isActive: true } },
      dealershipVehicle: { select: { isAvailable: true } },
    },
  });
  if (!slot) throw new AppError(404, 'NOT_FOUND', 'Time slot not found');
  return slot;
};

export type BookableSlot = Awaited<ReturnType<typeof loadSlotForBooking>>;

export const assertSlotBookable = (slot: BookableSlot, now: Date): void => {
  const offered =
    slot.isActive &&
    slot.vehicle.isActive &&
    slot.dealership.isActive &&
    slot.dealershipVehicle.isAvailable;
  if (!offered) throw slotUnavailable();
  if (slot.startAt <= now) {
    throw new AppError(422, 'SLOT_IN_PAST', 'This time slot has already started', [
      { field: 'slotId', message: 'Choose a slot that starts in the future' },
    ]);
  }
};

export const assertSlotFree = async (tx: Tx, slotId: string): Promise<void> => {
  const taken = await tx.booking.count({
    where: { slotId, status: { in: ACTIVE_BOOKING_STATUSES } },
  });
  if (taken > 0) throw slotUnavailable();
};

export const assertNoCustomerOverlap = async (
  tx: Tx,
  customerId: string,
  slot: BookableSlot,
  excludeBookingId?: string,
): Promise<void> => {
  const overlapping = await tx.booking.findFirst({
    where: {
      customerId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      slot: { startAt: { lt: slot.endAt }, endAt: { gt: slot.startAt } },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: {
      slot: {
        select: {
          startAt: true,
          endAt: true,
          vehicle: { select: { manufacturer: true, model: true } },
        },
      },
    },
  });
  if (!overlapping) return;
  const { vehicle, startAt, endAt } = overlapping.slot;
  throw new AppError(
    409,
    'BOOKING_CONFLICT',
    `An active test drive of the ${vehicle.manufacturer} ${vehicle.model} (${formatSlotWindow(startAt, endAt)}) already overlaps this time`,
  );
};

export const assertUnderBookingLimit = async (tx: Tx, customerId: string): Promise<void> => {
  const activeCount = await tx.booking.count({
    where: { customerId, status: { in: ACTIVE_BOOKING_STATUSES } },
  });
  if (activeCount >= env.MAX_ACTIVE_BOOKINGS) {
    throw new AppError(
      409,
      'ACTIVE_BOOKING_LIMIT',
      `You can have at most ${env.MAX_ACTIVE_BOOKINGS} active test-drive bookings at a time. Cancel or complete one before booking another`,
    );
  }
};

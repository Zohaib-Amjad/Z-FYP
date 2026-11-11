import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { ACTIVE_BOOKING_STATUSES } from '../utils/bookingStatus';
import type { ErrorDetail } from '../utils/response';

const MIN_SLOT_MINUTES = 15;
const MAX_SLOT_MINUTES = 240;

type Client = Prisma.TransactionClient | typeof prisma;

export interface TimeRange {
  startAt: Date;
  endAt: Date;
}

export interface ClashingSlot extends TimeRange {
  id: string;
  dealershipName: string;
}

const MINUTE_MS = 60_000;

export const validationError = (details: ErrorDetail[]): AppError =>
  new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details);

export const assertValidRange = ({ startAt, endAt }: TimeRange): void => {
  if (endAt <= startAt) {
    throw validationError([
      { field: 'endAt', message: 'The end time must be after the start time' },
    ]);
  }
  const minutes = (endAt.getTime() - startAt.getTime()) / MINUTE_MS;
  if (minutes < MIN_SLOT_MINUTES || minutes > MAX_SLOT_MINUTES) {
    throw validationError([
      {
        field: 'endAt',
        message: `A slot must last between ${MIN_SLOT_MINUTES} and ${MAX_SLOT_MINUTES} minutes`,
      },
    ]);
  }
};

export const assertInFuture = (startAt: Date, now: Date = new Date()): void => {
  if (startAt <= now) {
    throw new AppError(422, 'SLOT_IN_PAST', 'A slot must start in the future', [
      { field: 'startAt', message: 'Choose a start time that is later than now' },
    ]);
  }
};

export const assertSchedulable = async (
  client: Client,
  dealershipId: string,
  vehicleId: string,
): Promise<void> => {
  const [dealership, vehicle, link] = await Promise.all([
    client.dealership.findUnique({ where: { id: dealershipId }, select: { isActive: true } }),
    client.vehicle.findUnique({ where: { id: vehicleId }, select: { isActive: true } }),
    client.dealershipVehicle.findUnique({
      where: { dealershipId_vehicleId: { dealershipId, vehicleId } },
      select: { isAvailable: true },
    }),
  ]);
  const details: ErrorDetail[] = [];
  if (!dealership) details.push({ field: 'dealershipId', message: 'Dealership not found' });
  else if (!dealership.isActive) {
    details.push({ field: 'dealershipId', message: 'Dealership is deactivated' });
  }
  if (!vehicle) details.push({ field: 'vehicleId', message: 'Vehicle not found' });
  else if (!vehicle.isActive)
    details.push({ field: 'vehicleId', message: 'Vehicle is deactivated' });
  if (details.length === 0 && !link?.isAvailable) {
    details.push({
      field: 'vehicleId',
      message: 'This vehicle is not offered at this dealership',
    });
  }
  if (details.length > 0) throw validationError(details);
};

export const findClashes = async (
  client: Client,
  vehicleId: string,
  ranges: TimeRange[],
  excludeSlotId?: string,
): Promise<(ClashingSlot | null)[]> => {
  if (ranges.length === 0) return [];
  const earliest = new Date(Math.min(...ranges.map(range => range.startAt.getTime())));
  const latest = new Date(Math.max(...ranges.map(range => range.endAt.getTime())));
  const existing = await client.timeSlot.findMany({
    where: {
      vehicleId,
      isActive: true,
      startAt: { lt: latest },
      endAt: { gt: earliest },
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
    },
    select: { id: true, startAt: true, endAt: true, dealership: { select: { name: true } } },
    orderBy: { startAt: 'asc' },
  });
  return ranges.map(range => {
    const clash = existing.find(slot => slot.startAt < range.endAt && slot.endAt > range.startAt);
    return clash
      ? {
          id: clash.id,
          startAt: clash.startAt,
          endAt: clash.endAt,
          dealershipName: clash.dealership.name,
        }
      : null;
  });
};

export const overlapError = (clash?: ClashingSlot): AppError =>
  new AppError(
    409,
    'SLOT_OVERLAP',
    'This time overlaps another active slot for the same vehicle',
    clash
      ? [
          {
            field: 'startAt',
            message: `Overlaps slot ${clash.id} (${clash.startAt.toISOString()} to ${clash.endAt.toISOString()}) at ${clash.dealershipName}`,
          },
        ]
      : undefined,
  );

export const isOverlapViolation = (error: unknown): boolean =>
  error instanceof Error && /time_slots_no_vehicle_overlap|23P01/.test(error.message);

export const activeBookingFilter: Prisma.BookingWhereInput = {
  status: { in: ACTIVE_BOOKING_STATUSES },
};

import { prisma } from '../../src/config/prisma';

const HOUR_MS = 3_600_000;

export const utcInstant = (daysFromNow: number, hour: number, minute = 0): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, hour, minute),
  );
};

interface Target {
  staff: { id: string };
  dealership: { id: string };
  vehicle: { id: string };
}

export const addSlot = (
  target: Target,
  startAt: Date,
  options: { endAt?: Date; isActive?: boolean } = {},
) =>
  prisma.timeSlot.create({
    data: {
      dealershipId: target.dealership.id,
      vehicleId: target.vehicle.id,
      startAt,
      endAt: options.endAt ?? new Date(startAt.getTime() + HOUR_MS),
      isActive: options.isActive ?? true,
      createdById: target.staff.id,
    },
  });

export const upcomingWeekday = (weekday: number, minDaysAhead = 7): string => {
  const date = utcInstant(minDaysAhead, 0);
  while (date.getUTCDay() !== weekday) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export const shiftDate = (date: string, days: number): string => {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

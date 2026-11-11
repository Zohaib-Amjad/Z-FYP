import { prisma } from '../config/prisma';
import type { AvailableSlotsQuery } from '../validators/slot.validators';
import { AppError } from '../utils/AppError';
import { availableSlotWhere } from '../utils/slotAvailability';
import { dateKeyInZone } from '../utils/timeZone';
import { validationError } from './slotRules';

const DEFAULT_RANGE_DAYS = 14;
const MAX_RANGE_DAYS = 60;
const DAY_MS = 86_400_000;

const resolveRange = (query: AvailableSlotsQuery, now: Date): { from: Date; to: Date } => {
  const from = query.from ?? now;
  const to = query.to ?? new Date(from.getTime() + DEFAULT_RANGE_DAYS * DAY_MS);
  if (to <= from) {
    throw validationError([
      { field: 'to', message: 'The end of the range must be after its start' },
    ]);
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw validationError([
      { field: 'to', message: `The date range can cover at most ${MAX_RANGE_DAYS} days` },
    ]);
  }
  return { from, to };
};

export const getAvailableSlots = async (vehicleId: string, query: AvailableSlotsQuery) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, isActive: true },
    select: { id: true },
  });
  if (!vehicle) throw new AppError(404, 'NOT_FOUND', 'Vehicle not found');

  const now = new Date();
  const { from, to } = resolveRange(query, now);
  const slots = await prisma.timeSlot.findMany({
    where: {
      AND: [availableSlotWhere(now), { startAt: { gte: from, lt: to } }],
      vehicleId,
      ...(query.dealershipId ? { dealershipId: query.dealershipId } : {}),
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      dealership: { select: { id: true, name: true, city: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  const slotsByDate: Record<string, typeof slots> = {};
  for (const slot of slots) {
    const key = dateKeyInZone(slot.startAt, query.timeZone);
    (slotsByDate[key] ??= []).push(slot);
  }
  return {
    vehicleId,
    timeZone: query.timeZone,
    range: { from, to },
    dates: Object.keys(slotsByDate),
    slotsByDate,
  };
};

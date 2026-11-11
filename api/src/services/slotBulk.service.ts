import { addMinutes } from 'date-fns';
import { prisma } from '../config/prisma';
import { BulkSlotsInput, MAX_BULK_SLOTS } from '../validators/slot.validators';
import { lockVehicle } from '../utils/locks';
import { addDaysToDate, daysBetween, weekdayOf, zonedTimeToUtc } from '../utils/timeZone';
import { ADMIN_SLOT_SELECT, toAdminSlot } from './slot.service';
import {
  ClashingSlot,
  TimeRange,
  assertSchedulable,
  findClashes,
  isOverlapViolation,
  overlapError,
  validationError,
} from './slotRules';

type SkipReason = 'IN_PAST' | 'OVERLAPS_EXISTING';

interface SkippedSlot extends TimeRange {
  reason: SkipReason;
  clashingSlot?: ClashingSlot;
}

const generateCandidates = (input: BulkSlotsInput): TimeRange[] => {
  const candidates: TimeRange[] = [];
  const dayCount = daysBetween(input.dateFrom, input.dateTo) + 1;
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDaysToDate(input.dateFrom, offset);
    if (!input.daysOfWeek.includes(weekdayOf(date))) continue;
    const dayEnd = zonedTimeToUtc(date, input.dailyEndTime, input.timeZone);
    let startAt = zonedTimeToUtc(date, input.dailyStartTime, input.timeZone);
    while (addMinutes(startAt, input.durationMinutes) <= dayEnd) {
      const endAt = addMinutes(startAt, input.durationMinutes);
      candidates.push({ startAt, endAt });
      startAt = addMinutes(endAt, input.breakMinutes);
    }
  }
  return candidates;
};

const assertNotTooMany = (count: number): void => {
  if (count > MAX_BULK_SLOTS) {
    throw validationError([
      {
        field: 'dateTo',
        message: `This would create ${count} slots; at most ${MAX_BULK_SLOTS} can be generated at once. Narrow the dates or the daily window`,
      },
    ]);
  }
};

const partition = async (
  tx: Parameters<typeof findClashes>[0],
  input: BulkSlotsInput,
  candidates: TimeRange[],
) => {
  const now = new Date();
  const skipped: SkippedSlot[] = [];
  const creatable: TimeRange[] = [];
  const upcoming = candidates.filter(candidate => {
    const past = candidate.startAt <= now;
    if (past) skipped.push({ ...candidate, reason: 'IN_PAST' });
    return !past;
  });
  const clashes = await findClashes(tx, input.vehicleId, upcoming);
  upcoming.forEach((candidate, index) => {
    const clash = clashes[index];
    if (clash) skipped.push({ ...candidate, reason: 'OVERLAPS_EXISTING', clashingSlot: clash });
    else creatable.push(candidate);
  });
  skipped.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return { creatable, skipped };
};

const totals = (candidates: number, slots: number, skipped: number) => ({
  candidates,
  slots,
  skipped,
});

export const previewBulkSlots = async (input: BulkSlotsInput) => {
  const candidates = generateCandidates(input);
  assertNotTooMany(candidates.length);
  await assertSchedulable(prisma, input.dealershipId, input.vehicleId);
  const { creatable, skipped } = await partition(prisma, input, candidates);
  return {
    dryRun: true,
    slots: creatable,
    skipped,
    totals: totals(candidates.length, creatable.length, skipped.length),
  };
};

export const createBulkSlots = async (input: BulkSlotsInput, staffId: string) => {
  const candidates = generateCandidates(input);
  assertNotTooMany(candidates.length);
  return prisma.$transaction(async tx => {
    await lockVehicle(tx, input.vehicleId);
    await assertSchedulable(tx, input.dealershipId, input.vehicleId);
    const { creatable, skipped } = await partition(tx, input, candidates);
    try {
      const created = await tx.timeSlot.createManyAndReturn({
        data: creatable.map(range => ({
          ...range,
          dealershipId: input.dealershipId,
          vehicleId: input.vehicleId,
          createdById: staffId,
        })),
        select: { id: true },
      });
      const rows = await tx.timeSlot.findMany({
        where: { id: { in: created.map(slot => slot.id) } },
        select: ADMIN_SLOT_SELECT,
        orderBy: { startAt: 'asc' },
      });
      return {
        dryRun: false,
        slots: rows.map(toAdminSlot),
        skipped,
        totals: totals(candidates.length, rows.length, skipped.length),
      };
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapError();
      throw error;
    }
  });
};

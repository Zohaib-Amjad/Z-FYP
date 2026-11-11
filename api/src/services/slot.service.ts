import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type {
  AdminSlotQuery,
  CreateSlotInput,
  UpdateSlotInput,
} from '../validators/slot.validators';
import { AppError } from '../utils/AppError';
import { lockSlot, lockVehicle } from '../utils/locks';
import { buildPage, toSkipTake } from '../utils/pagination';
import {
  activeBookingFilter,
  assertInFuture,
  assertSchedulable,
  assertValidRange,
  findClashes,
  isOverlapViolation,
  overlapError,
} from './slotRules';

export const ADMIN_SLOT_SELECT = {
  id: true,
  startAt: true,
  endAt: true,
  isActive: true,
  createdAt: true,
  dealership: { select: { id: true, name: true, city: true } },
  vehicle: { select: { id: true, manufacturer: true, model: true } },
  bookings: {
    where: activeBookingFilter,
    take: 1,
    select: {
      id: true,
      status: true,
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
} satisfies Prisma.TimeSlotSelect;

type SlotRow = Prisma.TimeSlotGetPayload<{ select: typeof ADMIN_SLOT_SELECT }>;

export const toAdminSlot = ({ bookings, ...slot }: SlotRow) => ({
  ...slot,
  activeBooking: bookings[0] ?? null,
});

const slotNotFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Slot not found');

const hasActiveBooking = async (tx: Prisma.TransactionClient, slotId: string): Promise<boolean> =>
  (await tx.booking.count({ where: { slotId, ...activeBookingFilter } })) > 0;

const bookedError = (instruction: string): AppError =>
  new AppError(409, 'HAS_ACTIVE_BOOKINGS', `This slot has an active booking. ${instruction}`);

const whereFor = (query: AdminSlotQuery): Prisma.TimeSlotWhereInput => ({
  ...(query.dealershipId ? { dealershipId: query.dealershipId } : {}),
  ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
  ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
  ...(query.from || query.to ? { startAt: { gte: query.from, lte: query.to } } : {}),
  ...(query.hasBooking === undefined
    ? {}
    : {
        bookings: query.hasBooking ? { some: activeBookingFilter } : { none: activeBookingFilter },
      }),
});

export const listAdminSlots = async (query: AdminSlotQuery) => {
  const where = whereFor(query);
  const [rows, total] = await prisma.$transaction([
    prisma.timeSlot.findMany({
      where,
      select: ADMIN_SLOT_SELECT,
      orderBy: [{ startAt: query.sortOrder }, { id: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.timeSlot.count({ where }),
  ]);
  return buildPage(rows.map(toAdminSlot), total, query);
};

export const getAdminSlot = async (id: string) => {
  const row = await prisma.timeSlot.findUnique({ where: { id }, select: ADMIN_SLOT_SELECT });
  if (!row) throw slotNotFound();
  return toAdminSlot(row);
};

export const createSlot = async (input: CreateSlotInput, staffId: string) => {
  assertValidRange(input);
  assertInFuture(input.startAt);
  return prisma.$transaction(async tx => {
    await lockVehicle(tx, input.vehicleId);
    await assertSchedulable(tx, input.dealershipId, input.vehicleId);
    const [clash] = await findClashes(tx, input.vehicleId, [input]);
    if (clash) throw overlapError(clash);
    try {
      const row = await tx.timeSlot.create({
        data: { ...input, createdById: staffId },
        select: ADMIN_SLOT_SELECT,
      });
      return toAdminSlot(row);
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapError();
      throw error;
    }
  });
};

export const updateSlotTimes = (id: string, input: UpdateSlotInput) =>
  prisma.$transaction(async tx => {
    const found = await tx.timeSlot.findUnique({ where: { id }, select: { vehicleId: true } });
    if (!found) throw slotNotFound();
    await lockVehicle(tx, found.vehicleId);
    await lockSlot(tx, id);
    const slot = await tx.timeSlot.findUniqueOrThrow({
      where: { id },
      select: { startAt: true, endAt: true, isActive: true },
    });
    if (await hasActiveBooking(tx, id)) {
      throw bookedError('Reschedule the booking to another slot instead of changing this slot.');
    }
    if (slot.startAt <= new Date()) {
      throw new AppError(409, 'SLOT_IN_PAST', 'A slot that has already started cannot be changed');
    }
    const range = { startAt: input.startAt ?? slot.startAt, endAt: input.endAt ?? slot.endAt };
    assertValidRange(range);
    assertInFuture(range.startAt);
    if (slot.isActive) {
      const [clash] = await findClashes(tx, found.vehicleId, [range], id);
      if (clash) throw overlapError(clash);
    }
    try {
      return toAdminSlot(
        await tx.timeSlot.update({ where: { id }, data: range, select: ADMIN_SLOT_SELECT }),
      );
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapError();
      throw error;
    }
  });

export const deactivateSlot = (id: string) =>
  prisma.$transaction(async tx => {
    const found = await tx.timeSlot.findUnique({ where: { id }, select: { vehicleId: true } });
    if (!found) throw slotNotFound();
    await lockVehicle(tx, found.vehicleId);
    await lockSlot(tx, id);
    if (await hasActiveBooking(tx, id)) {
      throw bookedError('Cancel or reschedule the booking before deactivating the slot.');
    }
    return toAdminSlot(
      await tx.timeSlot.update({
        where: { id },
        data: { isActive: false },
        select: ADMIN_SLOT_SELECT,
      }),
    );
  });

export const activateSlot = (id: string) =>
  prisma.$transaction(async tx => {
    const found = await tx.timeSlot.findUnique({
      where: { id },
      select: { vehicleId: true, startAt: true, endAt: true, isActive: true },
    });
    if (!found) throw slotNotFound();
    await lockVehicle(tx, found.vehicleId);
    await lockSlot(tx, id);
    if (!found.isActive) {
      const [clash] = await findClashes(tx, found.vehicleId, [found], id);
      if (clash) throw overlapError(clash);
    }
    try {
      return toAdminSlot(
        await tx.timeSlot.update({
          where: { id },
          data: { isActive: true },
          select: ADMIN_SLOT_SELECT,
        }),
      );
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapError();
      throw error;
    }
  });

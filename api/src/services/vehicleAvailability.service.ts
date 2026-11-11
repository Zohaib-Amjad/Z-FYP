import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { ReplaceDealershipsInput } from '../validators/vehicle.validators';
import { AppError } from '../utils/AppError';
import { ACTIVE_BOOKING_STATUSES } from '../utils/bookingStatus';
import { lockVehicle } from '../utils/locks';
import type { ErrorDetail } from '../utils/response';
import { vehicleNotFound } from './vehicle.service';

type Tx = Prisma.TransactionClient;
type Requested = ReplaceDealershipsInput['dealerships'];

interface ExistingLink {
  dealershipId: string;
  isAvailable: boolean;
  name: string;
  slotCount: number;
}

interface Blocker {
  link: ExistingLink;
  bookings: number;
  slots: number;
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

const loadExistingLinks = async (tx: Tx, vehicleId: string): Promise<ExistingLink[]> => {
  const links = await tx.dealershipVehicle.findMany({
    where: { vehicleId },
    select: {
      dealershipId: true,
      isAvailable: true,
      dealership: { select: { name: true } },
      _count: { select: { timeSlots: true } },
    },
  });
  return links.map(link => ({
    dealershipId: link.dealershipId,
    isAvailable: link.isAvailable,
    name: link.dealership.name,
    slotCount: link._count.timeSlots,
  }));
};

const validateAdditions = async (
  tx: Tx,
  requested: Requested,
  existing: Map<string, ExistingLink>,
): Promise<void> => {
  const additions = requested
    .map((item, index) => ({ ...item, index }))
    .filter(item => !existing.has(item.dealershipId));
  if (additions.length === 0) return;
  const found = await tx.dealership.findMany({
    where: { id: { in: additions.map(item => item.dealershipId) } },
    select: { id: true, isActive: true },
  });
  const byId = new Map(found.map(dealership => [dealership.id, dealership]));
  const details: ErrorDetail[] = additions.flatMap(item => {
    const dealership = byId.get(item.dealershipId);
    const field = `dealerships.${item.index}.dealershipId`;
    if (!dealership) return [{ field, message: 'Dealership not found' }];
    if (!dealership.isActive) return [{ field, message: 'Dealership is deactivated' }];
    return [];
  });
  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details);
  }
};

const findBlockers = async (
  tx: Tx,
  vehicleId: string,
  withdrawn: ExistingLink[],
): Promise<Blocker[]> => {
  const now = new Date();
  const blockers: Blocker[] = [];
  for (const link of withdrawn) {
    const [bookings, slots] = await Promise.all([
      tx.booking.count({
        where: {
          status: { in: ACTIVE_BOOKING_STATUSES },
          slot: { vehicleId, dealershipId: link.dealershipId, startAt: { gt: now } },
        },
      }),
      tx.timeSlot.count({
        where: { vehicleId, dealershipId: link.dealershipId, isActive: true, startAt: { gt: now } },
      }),
    ]);
    if (bookings > 0 || slots > 0) blockers.push({ link, bookings, slots });
  }
  return blockers;
};

const blockedError = (blockers: Blocker[]): AppError => {
  const hasBookings = blockers.some(blocker => blocker.bookings > 0);
  const details = blockers.map(({ link, bookings, slots }) => ({
    field: `dealerships.${link.dealershipId}`,
    message: `${link.name}: ${plural(bookings, 'upcoming active booking')}, ${plural(slots, 'active upcoming slot')}`,
  }));
  return new AppError(
    409,
    hasBookings ? 'HAS_ACTIVE_BOOKINGS' : 'CONFLICT',
    hasBookings
      ? 'This vehicle cannot be withdrawn from a dealership that has upcoming active bookings. Cancel or reschedule them first.'
      : 'This vehicle cannot be withdrawn from a dealership that still has active upcoming slots. Deactivate those slots first.',
    details,
  );
};

const applyChanges = async (
  tx: Tx,
  vehicleId: string,
  requested: Requested,
  existing: Map<string, ExistingLink>,
): Promise<void> => {
  const requestedIds = new Set(requested.map(item => item.dealershipId));
  for (const item of requested) {
    await tx.dealershipVehicle.upsert({
      where: { dealershipId_vehicleId: { dealershipId: item.dealershipId, vehicleId } },
      update: { isAvailable: item.isAvailable },
      create: { dealershipId: item.dealershipId, vehicleId, isAvailable: item.isAvailable },
    });
  }
  for (const link of existing.values()) {
    if (requestedIds.has(link.dealershipId)) continue;
    const key = { dealershipId_vehicleId: { dealershipId: link.dealershipId, vehicleId } };
    if (link.slotCount > 0) {
      await tx.dealershipVehicle.update({ where: key, data: { isAvailable: false } });
    } else {
      await tx.dealershipVehicle.delete({ where: key });
    }
  }
};

export const listVehicleDealerships = async (vehicleId: string) => {
  const links = await prisma.dealershipVehicle.findMany({
    where: { vehicleId },
    select: {
      isAvailable: true,
      dealership: { select: { id: true, name: true, city: true, isActive: true } },
    },
    orderBy: { dealership: { name: 'asc' } },
  });
  return links.map(link => ({ ...link.dealership, isAvailable: link.isAvailable }));
};

export const replaceVehicleDealerships = async (
  vehicleId: string,
  { dealerships: requested }: ReplaceDealershipsInput,
) => {
  await prisma.$transaction(async tx => {
    await lockVehicle(tx, vehicleId);
    if (!(await tx.vehicle.count({ where: { id: vehicleId } }))) throw vehicleNotFound();

    const existing = new Map(
      (await loadExistingLinks(tx, vehicleId)).map(link => [link.dealershipId, link]),
    );
    await validateAdditions(tx, requested, existing);

    const keepAvailable = new Set(
      requested.filter(item => item.isAvailable).map(item => item.dealershipId),
    );
    const withdrawn = [...existing.values()].filter(
      link => link.isAvailable && !keepAvailable.has(link.dealershipId),
    );
    const blockers = await findBlockers(tx, vehicleId, withdrawn);
    if (blockers.length > 0) throw blockedError(blockers);

    await applyChanges(tx, vehicleId, requested, existing);
  });
  return listVehicleDealerships(vehicleId);
};

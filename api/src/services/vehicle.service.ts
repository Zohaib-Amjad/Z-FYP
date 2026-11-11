import type { Prisma } from '@prisma/client';
import { escapeLike } from '../utils/likeEscape';
import { prisma } from '../config/prisma';
import type {
  AdminVehicleQuery,
  CreateVehicleInput,
  UpdateVehicleInput,
} from '../validators/vehicle.validators';
import { AppError } from '../utils/AppError';
import { ACTIVE_BOOKING_STATUSES } from '../utils/bookingStatus';
import { lockVehicle } from '../utils/locks';
import { buildPage, toSkipTake } from '../utils/pagination';
import { IMAGE_ORDER, IMAGE_SELECT, VEHICLE_SELECT, toVehicleDto } from '../utils/vehicleDto';

const LIST_SELECT = {
  ...VEHICLE_SELECT,
  images: { where: { isPrimary: true }, select: IMAGE_SELECT, take: 1 },
  _count: { select: { dealerships: true } },
} satisfies Prisma.VehicleSelect;

const DETAIL_SELECT = {
  ...VEHICLE_SELECT,
  images: { select: IMAGE_SELECT, orderBy: IMAGE_ORDER },
  dealerships: {
    select: {
      isAvailable: true,
      dealership: { select: { id: true, name: true, city: true, isActive: true } },
    },
    orderBy: { dealership: { name: 'asc' } },
  },
} satisfies Prisma.VehicleSelect;

export const vehicleNotFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Vehicle not found');

const futureActiveBookingsForVehicle = (vehicleId: string): Prisma.BookingWhereInput => ({
  status: { in: ACTIVE_BOOKING_STATUSES },
  slot: { vehicleId, startAt: { gt: new Date() } },
});

const orderByFor = (
  sortBy: AdminVehicleQuery['sortBy'],
  order: AdminVehicleQuery['sortOrder'],
): Prisma.VehicleOrderByWithRelationInput[] => {
  const primary: Prisma.VehicleOrderByWithRelationInput[] =
    sortBy === 'manufacturer'
      ? [{ manufacturer: order }, { model: order }]
      : sortBy === 'priceFrom'
        ? [{ priceFrom: { sort: order, nulls: 'last' } }]
        : [{ [sortBy]: order }];
  return [...primary, { id: 'asc' }];
};

const whereFor = (query: AdminVehicleQuery): Prisma.VehicleWhereInput => ({
  ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
  ...(query.manufacturer
    ? { manufacturer: { equals: query.manufacturer, mode: 'insensitive' } }
    : {}),
  ...(query.vehicleType ? { vehicleType: query.vehicleType } : {}),
  ...(query.fuelType ? { fuelType: query.fuelType } : {}),
  ...(query.dealershipId ? { dealerships: { some: { dealershipId: query.dealershipId } } } : {}),
  AND: (query.q?.split(/\s+/) ?? []).filter(Boolean).map(term => ({
    OR: [
      { manufacturer: { contains: escapeLike(term), mode: 'insensitive' } },
      { model: { contains: escapeLike(term), mode: 'insensitive' } },
      { color: { contains: escapeLike(term), mode: 'insensitive' } },
      { engine: { contains: escapeLike(term), mode: 'insensitive' } },
    ],
  })),
});

export const listAdminVehicles = async (query: AdminVehicleQuery) => {
  const where = whereFor(query);
  const [rows, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      select: LIST_SELECT,
      orderBy: orderByFor(query.sortBy, query.sortOrder),
      ...toSkipTake(query),
    }),
    prisma.vehicle.count({ where }),
  ]);
  const items = rows.map(({ images, _count, ...row }) => ({
    ...toVehicleDto(row),
    primaryImage: images.at(0) ?? null,
    dealershipCount: _count.dealerships,
  }));
  return buildPage(items, total, query);
};

export const getAdminVehicle = async (id: string) => {
  const row = await prisma.vehicle.findUnique({ where: { id }, select: DETAIL_SELECT });
  if (!row) throw vehicleNotFound();
  const { images, dealerships, ...vehicle } = row;
  const upcomingActiveBookingCount = await prisma.booking.count({
    where: futureActiveBookingsForVehicle(id),
  });
  return {
    ...toVehicleDto(vehicle),
    images,
    dealerships: dealerships.map(link => ({ ...link.dealership, isAvailable: link.isAvailable })),
    upcomingActiveBookingCount,
  };
};

export const createVehicle = async (input: CreateVehicleInput) => {
  const row = await prisma.vehicle.create({
    data: { ...input, features: input.features ?? [] },
    select: VEHICLE_SELECT,
  });
  return toVehicleDto(row);
};

export const updateVehicle = async (id: string, input: UpdateVehicleInput) => {
  const exists = await prisma.vehicle.count({ where: { id } });
  if (!exists) throw vehicleNotFound();
  const row = await prisma.vehicle.update({ where: { id }, data: input, select: VEHICLE_SELECT });
  return toVehicleDto(row);
};

export const deactivateVehicle = (id: string) =>
  prisma.$transaction(async tx => {
    await lockVehicle(tx, id);
    const current = await tx.vehicle.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) throw vehicleNotFound();
    if (current.isActive) {
      const blocking = await tx.booking.count({ where: futureActiveBookingsForVehicle(id) });
      if (blocking > 0) {
        throw new AppError(
          409,
          'HAS_ACTIVE_BOOKINGS',
          `This vehicle has ${blocking} upcoming active booking${blocking === 1 ? '' : 's'}. Cancel or reschedule ${blocking === 1 ? 'it' : 'them'} before deactivating.`,
          [{ field: 'activeBookingCount', message: String(blocking) }],
        );
      }
    }
    return toVehicleDto(
      await tx.vehicle.update({ where: { id }, data: { isActive: false }, select: VEHICLE_SELECT }),
    );
  });

export const activateVehicle = async (id: string) => {
  const exists = await prisma.vehicle.count({ where: { id } });
  if (!exists) throw vehicleNotFound();
  const row = await prisma.vehicle.update({
    where: { id },
    data: { isActive: true },
    select: VEHICLE_SELECT,
  });
  return toVehicleDto(row);
};

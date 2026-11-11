import type { Prisma } from '@prisma/client';
import { escapeLike } from '../utils/likeEscape';
import { prisma } from '../config/prisma';
import type {
  AdminDealershipQuery,
  CreateDealershipInput,
  PublicDealershipQuery,
  UpdateDealershipInput,
} from '../validators/dealership.validators';
import { AppError } from '../utils/AppError';
import { ACTIVE_BOOKING_STATUSES } from '../utils/bookingStatus';
import { lockDealership } from '../utils/locks';
import { Page, buildPage, toSkipTake } from '../utils/pagination';
import { isUniqueViolation } from '../utils/prismaErrors';

const PUBLIC_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  phone: true,
  email: true,
  openingHours: true,
  description: true,
} satisfies Prisma.DealershipSelect;

const ADMIN_SELECT = {
  ...PUBLIC_SELECT,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { vehicles: true } },
} satisfies Prisma.DealershipSelect;

type AdminRow = Prisma.DealershipGetPayload<{ select: typeof ADMIN_SELECT }>;

const toAdminDealership = ({ _count, ...dealership }: AdminRow) => ({
  ...dealership,
  vehicleCount: _count.vehicles,
});

const notFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Dealership not found');

const duplicateName = (): AppError =>
  new AppError(409, 'CONFLICT', 'A dealership with this name already exists in this city', [
    { field: 'name', message: 'This name is already used by another dealership in this city' },
  ]);

const futureActiveBookingsWhere = (dealershipId: string): Prisma.BookingWhereInput => ({
  status: { in: ACTIVE_BOOKING_STATUSES },
  slot: { dealershipId, startAt: { gt: new Date() } },
});

const MAX_PUBLIC_DEALERSHIPS = 100;

export const listPublicDealerships = (query: PublicDealershipQuery) =>
  prisma.dealership.findMany({
    where: {
      isActive: true,
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.vehicleId
        ? {
            vehicles: {
              some: {
                vehicleId: query.vehicleId,
                isAvailable: true,
                vehicle: { isActive: true },
              },
            },
          }
        : {}),
    },
    select: PUBLIC_SELECT,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    take: MAX_PUBLIC_DEALERSHIPS,
  });

export const getPublicDealership = async (id: string) => {
  const dealership = await prisma.dealership.findFirst({
    where: { id, isActive: true },
    select: PUBLIC_SELECT,
  });
  if (!dealership) throw notFound();
  return dealership;
};

export const listAdminDealerships = async (query: AdminDealershipQuery) => {
  const terms = (query.q?.split(/\s+/) ?? []).filter(Boolean);
  const where: Prisma.DealershipWhereInput = {
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    AND: terms.map(term => ({
      OR: [
        { name: { contains: escapeLike(term), mode: 'insensitive' } },
        { city: { contains: escapeLike(term), mode: 'insensitive' } },
        { address: { contains: escapeLike(term), mode: 'insensitive' } },
        { email: { contains: escapeLike(term), mode: 'insensitive' } },
      ],
    })),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.dealership.findMany({
      where,
      select: ADMIN_SELECT,
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.dealership.count({ where }),
  ]);
  const page: Page<ReturnType<typeof toAdminDealership>> = buildPage(
    rows.map(toAdminDealership),
    total,
    query,
  );
  return page;
};

export const getAdminDealership = async (id: string) => {
  const row = await prisma.dealership.findUnique({ where: { id }, select: ADMIN_SELECT });
  if (!row) throw notFound();
  const upcomingActiveBookingCount = await prisma.booking.count({
    where: futureActiveBookingsWhere(id),
  });
  return { ...toAdminDealership(row), upcomingActiveBookingCount };
};

const assertNameAvailable = async (name: string, city: string, excludeId?: string) => {
  const clash = await prisma.dealership.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      city: { equals: city, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw duplicateName();
};

export const createDealership = async (input: CreateDealershipInput) => {
  await assertNameAvailable(input.name, input.city);
  try {
    const row = await prisma.dealership.create({
      data: { ...input, description: input.description ?? null },
      select: ADMIN_SELECT,
    });
    return toAdminDealership(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName();
    throw error;
  }
};

export const updateDealership = async (id: string, input: UpdateDealershipInput) => {
  const current = await prisma.dealership.findUnique({
    where: { id },
    select: { name: true, city: true },
  });
  if (!current) throw notFound();
  await assertNameAvailable(input.name ?? current.name, input.city ?? current.city, id);
  try {
    const row = await prisma.dealership.update({
      where: { id },
      data: input,
      select: ADMIN_SELECT,
    });
    return toAdminDealership(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName();
    throw error;
  }
};

export const deactivateDealership = (id: string) =>
  prisma.$transaction(async tx => {
    await lockDealership(tx, id);
    const current = await tx.dealership.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) throw notFound();
    if (!current.isActive) {
      return toAdminDealership(
        await tx.dealership.findUniqueOrThrow({ where: { id }, select: ADMIN_SELECT }),
      );
    }
    const blocking = await tx.booking.count({ where: futureActiveBookingsWhere(id) });
    if (blocking > 0) {
      throw new AppError(
        409,
        'HAS_ACTIVE_BOOKINGS',
        `This dealership has ${blocking} upcoming active booking${blocking === 1 ? '' : 's'}. Cancel or reschedule ${blocking === 1 ? 'it' : 'them'} before deactivating.`,
        [{ field: 'activeBookingCount', message: String(blocking) }],
      );
    }
    return toAdminDealership(
      await tx.dealership.update({
        where: { id },
        data: { isActive: false },
        select: ADMIN_SELECT,
      }),
    );
  });

export const activateDealership = async (id: string) => {
  const exists = await prisma.dealership.count({ where: { id } });
  if (!exists) throw notFound();
  const row = await prisma.dealership.update({
    where: { id },
    data: { isActive: true },
    select: ADMIN_SELECT,
  });
  return toAdminDealership(row);
};

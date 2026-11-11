import type { Prisma } from '@prisma/client';
import { escapeLike } from '../utils/likeEscape';
import { prisma } from '../config/prisma';
import type { CatalogQuery } from '../validators/catalog.validators';
import { AppError } from '../utils/AppError';
import { buildPage, toSkipTake } from '../utils/pagination';
import { availableSlotWhere } from '../utils/slotAvailability';
import {
  IMAGE_ORDER,
  IMAGE_SELECT,
  PUBLIC_VEHICLE_SELECT,
  toPublicVehicle,
} from '../utils/vehicleDto';

const LIST_SELECT = {
  id: true,
  manufacturer: true,
  model: true,
  year: true,
  vehicleType: true,
  fuelType: true,
  transmission: true,
  priceFrom: true,
  images: { where: { isPrimary: true }, select: IMAGE_SELECT, take: 1 },
  dealerships: {
    where: { isAvailable: true, dealership: { isActive: true } },
    select: { dealership: { select: { id: true, name: true, city: true } } },
    orderBy: { dealership: { name: 'asc' } },
  },
} satisfies Prisma.VehicleSelect;

const DETAIL_SELECT = {
  ...PUBLIC_VEHICLE_SELECT,
  images: { select: IMAGE_SELECT, orderBy: IMAGE_ORDER },
  dealerships: {
    where: { isAvailable: true, dealership: { isActive: true } },
    select: {
      dealership: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          phone: true,
          email: true,
          openingHours: true,
        },
      },
    },
    orderBy: { dealership: { name: 'asc' } },
  },
} satisfies Prisma.VehicleSelect;

const hasDealershipFilter = (query: CatalogQuery): boolean =>
  Boolean(query.dealershipId || query.city);

const dealershipMatch = (query: CatalogQuery): Prisma.DealershipWhereInput => ({
  isActive: true,
  ...(query.dealershipId ? { id: query.dealershipId } : {}),
  ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
});

const availableSlotsFor = (query: CatalogQuery): Prisma.TimeSlotWhereInput => ({
  ...availableSlotWhere(),
  ...(hasDealershipFilter(query) ? { dealership: dealershipMatch(query) } : {}),
});

const searchTerms = (q: string | undefined): string[] => (q?.split(/\s+/) ?? []).filter(Boolean);

const featureMatches = async (terms: string[]): Promise<Map<string, string[]>> => {
  const matches = new Map<string, string[]>();
  if (terms.length === 0) return matches;
  const rows = await prisma.$queryRaw<{ id: string; term: string }[]>`
    SELECT DISTINCT v.id::text AS id, t.term
    FROM vehicles v
    CROSS JOIN unnest(${terms}::text[]) AS t(term)
    WHERE v.is_active
      AND EXISTS (
        SELECT 1 FROM unnest(v.features) AS f WHERE strpos(lower(f), lower(t.term)) > 0
      )`;
  for (const { id, term } of rows) matches.set(term, [...(matches.get(term) ?? []), id]);
  return matches;
};

const textClauses = (terms: string[], matches: Map<string, string[]>): Prisma.VehicleWhereInput[] =>
  terms.map(term => ({
    OR: [
      { manufacturer: { contains: escapeLike(term), mode: 'insensitive' } },
      { model: { contains: escapeLike(term), mode: 'insensitive' } },
      { description: { contains: escapeLike(term), mode: 'insensitive' } },
      { id: { in: matches.get(term) ?? [] } },
    ],
  }));

const range = (min: number | undefined, max: number | undefined) =>
  min === undefined && max === undefined ? undefined : { gte: min, lte: max };

const buildWhere = (
  query: CatalogQuery,
  matches: Map<string, string[]>,
): Prisma.VehicleWhereInput => ({
  isActive: true,
  ...(query.manufacturer ? { manufacturer: { in: query.manufacturer, mode: 'insensitive' } } : {}),
  ...(query.model ? { model: { in: query.model, mode: 'insensitive' } } : {}),
  ...(query.vehicleType ? { vehicleType: { in: query.vehicleType } } : {}),
  ...(query.fuelType ? { fuelType: { in: query.fuelType } } : {}),
  ...(query.transmission ? { transmission: { in: query.transmission } } : {}),
  ...(range(query.minYear, query.maxYear) ? { year: range(query.minYear, query.maxYear) } : {}),
  ...(range(query.minPrice, query.maxPrice)
    ? { priceFrom: range(query.minPrice, query.maxPrice) }
    : {}),
  ...(hasDealershipFilter(query)
    ? { dealerships: { some: { isAvailable: true, dealership: dealershipMatch(query) } } }
    : {}),
  ...(query.availableOnly ? { timeSlots: { some: availableSlotsFor(query) } } : {}),
  AND: textClauses(searchTerms(query.q), matches),
});

const orderByFor = (sort: CatalogQuery['sort']): Prisma.VehicleOrderByWithRelationInput[] => {
  const primary: Prisma.VehicleOrderByWithRelationInput[] = {
    newest: [{ createdAt: 'desc' as const }],
    priceAsc: [{ priceFrom: { sort: 'asc' as const, nulls: 'last' as const } }],
    priceDesc: [{ priceFrom: { sort: 'desc' as const, nulls: 'last' as const } }],
    manufacturerAsc: [{ manufacturer: 'asc' as const }, { model: 'asc' as const }],
    powerDesc: [{ powerHp: 'desc' as const }],
  }[sort];
  return [...primary, { id: 'asc' }];
};

const nextSlotByVehicle = async (
  vehicleIds: string[],
  query: CatalogQuery,
): Promise<Map<string, Date>> => {
  if (vehicleIds.length === 0) return new Map();
  const groups = await prisma.timeSlot.groupBy({
    by: ['vehicleId'],
    where: { vehicleId: { in: vehicleIds }, ...availableSlotsFor(query) },
    _min: { startAt: true },
  });
  return new Map(
    groups.flatMap(group => (group._min.startAt ? [[group.vehicleId, group._min.startAt]] : [])),
  );
};

export const listCatalogVehicles = async (query: CatalogQuery) => {
  const matches = await featureMatches(searchTerms(query.q));
  const where = buildWhere(query, matches);
  const [rows, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      select: LIST_SELECT,
      orderBy: orderByFor(query.sort),
      ...toSkipTake(query),
    }),
    prisma.vehicle.count({ where }),
  ]);
  const nextSlots = await nextSlotByVehicle(
    rows.map(row => row.id),
    query,
  );
  const items = rows.map(({ images, dealerships, priceFrom, ...row }) => ({
    ...row,
    priceFrom: priceFrom?.toNumber() ?? null,
    primaryImage: images.at(0) ?? null,
    dealerships: dealerships.map(link => link.dealership),
    nextAvailableSlotAt: nextSlots.get(row.id) ?? null,
  }));
  return buildPage(items, total, query);
};

export const getCatalogFilters = async () => {
  const active = { isActive: true };
  const [pairs, types, fuels, transmissions, bounds, cities] = await Promise.all([
    prisma.vehicle.groupBy({ by: ['manufacturer', 'model'], where: active }),
    prisma.vehicle.groupBy({ by: ['vehicleType'], where: active }),
    prisma.vehicle.groupBy({ by: ['fuelType'], where: active }),
    prisma.vehicle.groupBy({ by: ['transmission'], where: active }),
    prisma.vehicle.aggregate({
      where: active,
      _min: { year: true, priceFrom: true },
      _max: { year: true, priceFrom: true },
    }),
    prisma.dealership.findMany({
      where: {
        isActive: true,
        vehicles: { some: { isAvailable: true, vehicle: active } },
      },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    }),
  ]);

  const byManufacturer = new Map<string, string[]>();
  for (const { manufacturer, model } of pairs) {
    byManufacturer.set(manufacturer, [...(byManufacturer.get(manufacturer) ?? []), model]);
  }
  const manufacturers = [...byManufacturer.keys()].sort((a, b) => a.localeCompare(b));
  const bound = (min: number | undefined | null, max: number | undefined | null) =>
    min == null || max == null ? null : { min, max };

  return {
    manufacturers,
    models: manufacturers.map(manufacturer => ({
      manufacturer,
      models: (byManufacturer.get(manufacturer) ?? []).sort((a, b) => a.localeCompare(b)),
    })),
    vehicleTypes: types.map(row => row.vehicleType).sort(),
    fuelTypes: fuels.map(row => row.fuelType).sort(),
    transmissions: transmissions.map(row => row.transmission).sort(),
    yearRange: bound(bounds._min.year, bounds._max.year),
    priceRange: bound(bounds._min.priceFrom?.toNumber(), bounds._max.priceFrom?.toNumber()),
    cities: cities.map(row => row.city),
  };
};

export const getCatalogVehicle = async (id: string) => {
  const row = await prisma.vehicle.findFirst({
    where: { id, isActive: true },
    select: DETAIL_SELECT,
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Vehicle not found');
  const { images, dealerships, ...vehicle } = row;
  const slotCounts = await prisma.timeSlot.groupBy({
    by: ['dealershipId'],
    where: { vehicleId: id, ...availableSlotWhere() },
    _count: { _all: true },
  });
  const countByDealership = new Map(
    slotCounts.map(group => [group.dealershipId, group._count._all]),
  );
  return {
    ...toPublicVehicle(vehicle),
    images,
    dealerships: dealerships.map(({ dealership }) => ({
      ...dealership,
      upcomingAvailableSlots: countByDealership.get(dealership.id) ?? 0,
    })),
  };
};

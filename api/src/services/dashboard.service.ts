import { prisma } from '../config/prisma';
import type {
  SummaryQuery,
  TopVehiclesQuery,
  TrendQuery,
} from '../validators/dashboard.validators';
import { BOOKING_SELECT } from '../utils/bookingDto';
import { availableSlotWhere } from '../utils/slotAvailability';
import {
  dayBoundariesInZone,
  startOfDayInZone,
  startOfMonthInZone,
  startOfNextDayInZone,
  startOfNextMonthInZone,
} from '../utils/timeZone';
import { IMAGE_SELECT } from '../utils/vehicleDto';
import { toAdminBookingItem } from './adminBooking.service';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const ATTENTION_LIST_SIZE = 10;

interface BookingCounts {
  pending: bigint;
  today: bigint;
  next7Days: bigint;
  approvedUpcoming: bigint;
  pendingOverdue: bigint;
  pastNotCompleted: bigint;
}

const bookingCounts = async (
  now: Date,
  todayStart: Date,
  tomorrowStart: Date,
): Promise<Record<keyof BookingCounts, number>> => {
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [row] = await prisma.$queryRaw<BookingCounts[]>`
    SELECT
      count(*) FILTER (WHERE b.status = 'PENDING') AS "pending",
      count(*) FILTER (
        WHERE b.status IN ('APPROVED', 'RESCHEDULED', 'COMPLETED')
          AND s.start_at >= ${todayStart}::timestamptz AND s.start_at < ${tomorrowStart}::timestamptz
      ) AS "today",
      count(*) FILTER (
        WHERE b.status IN ('APPROVED', 'RESCHEDULED')
          AND s.start_at > ${now}::timestamptz AND s.start_at <= ${weekEnd}::timestamptz
      ) AS "next7Days",
      count(*) FILTER (
        WHERE b.status IN ('APPROVED', 'RESCHEDULED') AND s.start_at > ${now}::timestamptz
      ) AS "approvedUpcoming",
      count(*) FILTER (
        WHERE b.status = 'PENDING' AND b.created_at < ${dayAgo}::timestamptz
      ) AS "pendingOverdue",
      count(*) FILTER (
        WHERE b.status IN ('APPROVED', 'RESCHEDULED') AND s.start_at <= ${now}::timestamptz
      ) AS "pastNotCompleted"
    FROM bookings b
    JOIN time_slots s ON s.id = b.slot_id`;
  return {
    pending: Number(row.pending),
    today: Number(row.today),
    next7Days: Number(row.next7Days),
    approvedUpcoming: Number(row.approvedUpcoming),
    pendingOverdue: Number(row.pendingOverdue),
    pastNotCompleted: Number(row.pastNotCompleted),
  };
};

const monthlyOutcomes = async (monthStart: Date, nextMonthStart: Date) => {
  const groups = await prisma.bookingStatusHistory.groupBy({
    by: ['toStatus'],
    where: {
      toStatus: { in: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      createdAt: { gte: monthStart, lt: nextMonthStart },
    },
    _count: { _all: true },
  });
  const countOf = (status: string): number =>
    groups.find(group => group.toStatus === status)?._count._all ?? 0;
  return {
    completed: countOf('COMPLETED'),
    cancelled: countOf('CANCELLED'),
    rejected: countOf('REJECTED'),
  };
};

const attentionLists = async (now: Date) => {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [pendingOverdue, pastNotCompleted] = await Promise.all([
    prisma.booking.findMany({
      where: { status: 'PENDING', createdAt: { lt: dayAgo } },
      select: BOOKING_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: ATTENTION_LIST_SIZE,
    }),
    prisma.booking.findMany({
      where: { status: { in: ['APPROVED', 'RESCHEDULED'] }, slot: { startAt: { lte: now } } },
      select: BOOKING_SELECT,
      orderBy: [{ slot: { startAt: 'asc' } }, { id: 'asc' }],
      take: ATTENTION_LIST_SIZE,
    }),
  ]);
  return {
    pendingOverdue: pendingOverdue.map(toAdminBookingItem),
    pastNotCompleted: pastNotCompleted.map(toAdminBookingItem),
  };
};

export const getDashboardSummary = async ({ timeZone }: SummaryQuery) => {
  const now = new Date();
  const todayStart = startOfDayInZone(now, timeZone);
  const tomorrowStart = startOfNextDayInZone(now, timeZone);
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS);
  const [counts, month, lists, totalCustomers, activeVehicles, activeDealerships, freeSlots] =
    await Promise.all([
      bookingCounts(now, todayStart, tomorrowStart),
      monthlyOutcomes(startOfMonthInZone(now, timeZone), startOfNextMonthInZone(now, timeZone)),
      attentionLists(now),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.vehicle.count({ where: { isActive: true } }),
      prisma.dealership.count({ where: { isActive: true } }),
      prisma.timeSlot.count({
        where: { AND: [availableSlotWhere(now), { startAt: { lte: weekEnd } }] },
      }),
    ]);
  return {
    generatedAt: now,
    timeZone,
    pending: counts.pending,
    todaysTestDrives: counts.today,
    next7Days: counts.next7Days,
    approvedUpcoming: counts.approvedUpcoming,
    completedThisMonth: month.completed,
    cancelledThisMonth: month.cancelled,
    rejectedThisMonth: month.rejected,
    totalCustomers,
    activeVehicles,
    activeDealerships,
    freeSlotsNext7Days: freeSlots,
    needsAttention: {
      pendingOlderThan24h: { count: counts.pendingOverdue, items: lists.pendingOverdue },
      pastNotCompleted: { count: counts.pastNotCompleted, items: lists.pastNotCompleted },
    },
  };
};

interface TrendRow {
  idx: number;
  pending: bigint;
  confirmed: bigint;
  completed: bigint;
  cancelled: bigint;
}

export const getBookingsTrend = async ({ days, timeZone }: TrendQuery) => {
  const boundaries = dayBoundariesInZone(new Date(), days, timeZone);
  const starts = boundaries.map(boundary => boundary.startAt.toISOString());
  const rows = await prisma.$queryRaw<TrendRow[]>`
    WITH days AS (
      SELECT t.start_at::timestamptz AS start_at,
             lead(t.start_at::timestamptz) OVER (ORDER BY t.idx) AS end_at,
             t.idx
      FROM unnest(${starts}::text[]) WITH ORDINALITY AS t(start_at, idx)
    )
    SELECT d.idx::int AS "idx",
      count(b.id) FILTER (WHERE b.status = 'PENDING') AS "pending",
      count(b.id) FILTER (WHERE b.status IN ('APPROVED', 'RESCHEDULED')) AS "confirmed",
      count(b.id) FILTER (WHERE b.status = 'COMPLETED') AS "completed",
      count(b.id) FILTER (WHERE b.status IN ('CANCELLED', 'REJECTED')) AS "cancelled"
    FROM days d
    LEFT JOIN bookings b ON b.created_at >= d.start_at AND b.created_at < d.end_at
    WHERE d.end_at IS NOT NULL
    GROUP BY d.idx
    ORDER BY d.idx`;
  const points = rows.map(row => {
    const counts = {
      pending: Number(row.pending),
      confirmed: Number(row.confirmed),
      completed: Number(row.completed),
      cancelled: Number(row.cancelled),
    };
    return {
      date: boundaries[row.idx - 1].date,
      ...counts,
      total: counts.pending + counts.confirmed + counts.completed + counts.cancelled,
    };
  });
  return {
    days,
    timeZone,
    from: boundaries[0].startAt,
    to: boundaries[boundaries.length - 1].startAt,
    points,
  };
};

interface TopVehicleRow {
  vehicleId: string;
  requests: bigint;
}

export const getTopVehicles = async ({ days, limit }: TopVehiclesQuery) => {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await prisma.$queryRaw<TopVehicleRow[]>`
    SELECT s.vehicle_id::text AS "vehicleId", count(*) AS "requests"
    FROM bookings b
    JOIN time_slots s ON s.id = b.slot_id
    JOIN vehicles v ON v.id = s.vehicle_id
    WHERE b.created_at >= ${since}::timestamptz
    GROUP BY s.vehicle_id, v.manufacturer, v.model
    ORDER BY count(*) DESC, v.manufacturer ASC, v.model ASC
    LIMIT ${limit}::int`;
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: rows.map(row => row.vehicleId) } },
    select: {
      id: true,
      manufacturer: true,
      model: true,
      year: true,
      isActive: true,
      images: { where: { isPrimary: true }, take: 1, select: IMAGE_SELECT },
    },
  });
  const byId = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  return {
    days,
    since,
    items: rows.flatMap(row => {
      const vehicle = byId.get(row.vehicleId);
      if (!vehicle) return [];
      const { images, ...fields } = vehicle;
      return [
        {
          vehicle: {
            ...fields,
            name: `${vehicle.manufacturer} ${vehicle.model}`,
            primaryImage: images.at(0) ?? null,
          },
          requests: Number(row.requests),
        },
      ];
    }),
  };
};

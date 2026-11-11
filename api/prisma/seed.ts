import path from 'path';
import bcrypt from 'bcryptjs';
import { addDays, addHours, isSaturday, isSunday, setHours, startOfDay, subDays } from 'date-fns';
import { BookingStatus, NotificationType, Prisma, PrismaClient, Role } from '@prisma/client';
import {
  CUSTOMERS,
  DEALERSHIPS,
  DEV_PASSWORD,
  SAMPLE_BOOKINGS,
  STAFF,
  VEHICLES,
  SampleBooking,
  SampleStep,
  VehicleSeed,
} from './seed-data';
import { writeSeedImageFiles } from './seed-images';

const prisma = new PrismaClient();

const BCRYPT_COST = 12;
const SLOT_WINDOW_DAYS = 14;
const WEEKDAY_FIRST_HOUR = 9;
const WEEKDAY_LAST_HOUR = 16;
const SATURDAY_LAST_HOUR = 12;
const DAY_MS = 86_400_000;

const uploadSeedDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR ?? 'uploads', 'seed');

const NOTIFICATION_BY_ACTION: Record<
  string,
  { type: NotificationType; title: string; message: string }
> = {
  CREATED: {
    type: 'BOOKING_CREATED',
    title: 'Test-drive request received',
    message:
      'Thank you. Your request has been received and is awaiting confirmation from our team.',
  },
  APPROVED: {
    type: 'BOOKING_APPROVED',
    title: 'Test drive confirmed',
    message: 'Your test drive has been approved. We look forward to welcoming you.',
  },
  REJECTED: {
    type: 'BOOKING_REJECTED',
    title: 'Test-drive request declined',
    message: 'We are unable to accommodate your request for the selected time.',
  },
  RESCHEDULED: {
    type: 'BOOKING_RESCHEDULED',
    title: 'Test drive rescheduled',
    message: 'Your appointment has been moved to a new time. Please review the updated details.',
  },
  CANCELLED: {
    type: 'BOOKING_CANCELLED',
    title: 'Test drive cancelled',
    message: 'Your appointment has been cancelled.',
  },
  COMPLETED: {
    type: 'BOOKING_COMPLETED',
    title: 'Thank you for visiting',
    message: 'We hope you enjoyed your test drive. Our team is available for any follow-up.',
  },
};

const seedUsers = async (passwordHash: string) => {
  const upsert = (
    email: string,
    role: Role,
    firstName: string,
    lastName: string,
    phone: string,
    license?: string,
  ) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        role,
        passwordHash,
        firstName,
        lastName,
        phone,
        drivingLicenseNumber: license ?? null,
      },
    });
  const staff = await Promise.all(
    STAFF.map(s => upsert(s.email, 'STAFF', s.firstName, s.lastName, s.phone)),
  );
  const customers = await Promise.all(
    CUSTOMERS.map(c => upsert(c.email, 'CUSTOMER', c.firstName, c.lastName, c.phone, c.license)),
  );
  return { staff, customers };
};

const seedDealerships = async () => {
  const result = [];
  for (const data of DEALERSHIPS) {
    const existing = await prisma.dealership.findFirst({ where: { name: data.name } });
    result.push(existing ?? (await prisma.dealership.create({ data })));
  }
  return result;
};

const writeVehicleImages = async (vehicleId: string, vehicle: VehicleSeed) => {
  const fileNames = writeSeedImageFiles(uploadSeedDir, vehicle);
  const images = fileNames.map((fileName, index) => ({
    vehicleId,
    url: `/uploads/seed/${fileName}`,
    altText: `${vehicle.manufacturer} ${vehicle.model} ${index === 0 ? 'exterior' : 'interior'}`,
    isPrimary: index === 0,
    sortOrder: index + 1,
  }));
  if ((await prisma.vehicleImage.count({ where: { vehicleId } })) === 0) {
    await prisma.vehicleImage.createMany({ data: images });
  }
};

const seedVehicles = async (dealerships: { id: string }[]) => {
  const result = [];
  for (const [index, { hues: _hues, ...data }] of VEHICLES.entries()) {
    const found = await prisma.vehicle.findFirst({
      where: { manufacturer: data.manufacturer, model: data.model, year: data.year },
    });
    const vehicle = found ?? (await prisma.vehicle.create({ data }));
    await writeVehicleImages(vehicle.id, VEHICLES[index]);
    const offered = offeredDealerships(index, dealerships);
    for (const dealership of offered) {
      await prisma.dealershipVehicle.upsert({
        where: { dealershipId_vehicleId: { dealershipId: dealership.id, vehicleId: vehicle.id } },
        update: {},
        create: { dealershipId: dealership.id, vehicleId: vehicle.id },
      });
    }
    result.push({ vehicle, offered });
  }
  return result;
};

const offeredDealerships = <T>(vehicleIndex: number, dealerships: T[]): T[] => {
  const count = 1 + (vehicleIndex % 3);
  return Array.from(
    { length: count },
    (_, k) => dealerships[(vehicleIndex + k) % dealerships.length],
  );
};

const slotHoursFor = (day: Date): number[] => {
  if (isSunday(day)) return [];
  const last = isSaturday(day) ? SATURDAY_LAST_HOUR : WEEKDAY_LAST_HOUR;
  return Array.from({ length: last - WEEKDAY_FIRST_HOUR + 1 }, (_, i) => WEEKDAY_FIRST_HOUR + i);
};

const dealershipForDay = <T>(day: Date, offered: T[]): T =>
  offered[Math.floor(startOfDay(day).getTime() / DAY_MS) % offered.length];

const seedFutureSlots = async (
  vehicles: { vehicle: { id: string }; offered: { id: string }[] }[],
  createdById: string,
) => {
  const today = startOfDay(new Date());
  for (const { vehicle, offered } of vehicles) {
    const candidates: Prisma.TimeSlotCreateManyInput[] = [];
    for (let offset = 1; offset <= SLOT_WINDOW_DAYS; offset += 1) {
      const day = addDays(today, offset);
      const dealership = dealershipForDay(day, offered);
      for (const hour of slotHoursFor(day)) {
        const startAt = setHours(day, hour);
        candidates.push({
          vehicleId: vehicle.id,
          dealershipId: dealership.id,
          startAt,
          endAt: addHours(startAt, 1),
          createdById,
        });
      }
    }
    const existing = await prisma.timeSlot.findMany({
      where: { vehicleId: vehicle.id, startAt: { gte: today } },
      select: { startAt: true },
    });
    const taken = new Set(existing.map(slot => slot.startAt.getTime()));
    const missing = candidates.filter(slot => !taken.has((slot.startAt as Date).getTime()));
    if (missing.length > 0) await prisma.timeSlot.createMany({ data: missing });
  }
};

const resolveSlotStart = (days: number, hour: number): Date => {
  let day = startOfDay(addDays(new Date(), days));
  if (days > 0 && isSunday(day)) day = addDays(day, 1);
  const clamped = isSaturday(day) && days > 0 ? Math.min(hour, SATURDAY_LAST_HOUR) : hour;
  return setHours(day, clamped);
};

const ensureSlot = async (
  vehicle: { vehicle: { id: string }; offered: { id: string }[] },
  days: number,
  hour: number,
  createdById: string,
) => {
  const startAt = resolveSlotStart(days, hour);
  const found = await prisma.timeSlot.findFirst({
    where: { vehicleId: vehicle.vehicle.id, startAt },
  });
  if (found) return found;
  return prisma.timeSlot.create({
    data: {
      vehicleId: vehicle.vehicle.id,
      dealershipId: dealershipForDay(startAt, vehicle.offered).id,
      startAt,
      endAt: addHours(startAt, 1),
      createdById,
    },
  });
};

interface SeedContext {
  customers: { id: string }[];
  staffId: string;
  vehicles: { vehicle: { id: string }; offered: { id: string }[] }[];
}

const finalStatus = (sample: SampleBooking): BookingStatus =>
  sample.steps[sample.steps.length - 1].to;

const historyRows = (
  bookingId: string,
  sample: SampleBooking,
  slots: { first: string; last: string },
  base: Date,
  ctx: SeedContext,
): Prisma.BookingStatusHistoryCreateManyInput[] =>
  sample.steps.map((step: SampleStep, index) => ({
    bookingId,
    fromStatus: index === 0 ? null : sample.steps[index - 1].to,
    toStatus: step.to,
    action: step.action,
    note: step.note,
    oldSlotId: step.action === 'RESCHEDULED' ? slots.first : null,
    newSlotId: step.action === 'RESCHEDULED' ? slots.last : null,
    changedById: step.by === 'customer' ? ctx.customers[sample.customer].id : ctx.staffId,
    createdAt: addHours(base, index * 6),
  }));

const notificationRows = (
  bookingId: string,
  sample: SampleBooking,
  base: Date,
  ctx: SeedContext,
): Prisma.NotificationCreateManyInput[] =>
  sample.steps.map((step, index) => ({
    userId: ctx.customers[sample.customer].id,
    bookingId,
    ...NOTIFICATION_BY_ACTION[step.action],
    isRead: !sample.unread,
    createdAt: addHours(base, index * 6),
  }));

const seedBooking = async (sample: SampleBooking, ctx: SeedContext) => {
  const vehicle = ctx.vehicles[sample.vehicle];
  const firstSlot = await ensureSlot(vehicle, sample.days, sample.hour, ctx.staffId);
  const lastSlot = sample.rescheduleTo
    ? await ensureSlot(vehicle, sample.rescheduleTo.days, sample.rescheduleTo.hour, ctx.staffId)
    : firstSlot;
  const customerId = ctx.customers[sample.customer].id;
  const exists = await prisma.booking.findFirst({
    where: { customerId, slotId: { in: [firstSlot.id, lastSlot.id] } },
  });
  if (exists) return;

  const status = finalStatus(sample);
  const base = subDays(new Date(Math.min(Date.now(), firstSlot.startAt.getTime())), 3);
  const booking = await prisma.booking.create({
    data: {
      customerId,
      slotId: lastSlot.id,
      status,
      customerNote: sample.customerNote,
      staffNote: sample.staffNote ?? null,
      rejectionReason: sample.rejectionReason ?? null,
      cancellationReason: sample.cancellationReason ?? null,
      cancelledBy: sample.cancelledBy ?? null,
      approvedAt: sample.steps.some(s => s.to === 'APPROVED') ? addHours(base, 6) : null,
      completedAt: status === 'COMPLETED' ? lastSlot.endAt : null,
      createdAt: base,
    },
  });
  const slots = { first: firstSlot.id, last: lastSlot.id };
  await prisma.bookingStatusHistory.createMany({
    data: historyRows(booking.id, sample, slots, base, ctx),
  });
  await prisma.notification.createMany({ data: notificationRows(booking.id, sample, base, ctx) });
};

const main = async () => {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_COST);
  const { staff, customers } = await seedUsers(passwordHash);
  const dealerships = await seedDealerships();
  const vehicles = await seedVehicles(dealerships);
  await seedFutureSlots(vehicles, staff[0].id);
  const ctx: SeedContext = { customers, staffId: staff[0].id, vehicles };
  for (const sample of SAMPLE_BOOKINGS) {
    await seedBooking(sample, ctx);
  }

  const [slotCount, bookingCount] = await Promise.all([
    prisma.timeSlot.count(),
    prisma.booking.count(),
  ]);
  console.log('Seed complete.');
  console.log(`  Users: ${staff.length} staff, ${customers.length} customers`);
  console.log(`  Dealerships: ${dealerships.length}, vehicles: ${vehicles.length}`);
  console.log(`  Time slots: ${slotCount}, bookings: ${bookingCount}`);
  console.log(
    process.env.SEED_PASSWORD
      ? '  Password for every account: the value of SEED_PASSWORD'
      : `  Development password for every account: ${DEV_PASSWORD}`,
  );
  console.log(`  Staff logins: ${STAFF.map(s => s.email).join(', ')}`);
  console.log(`  Customer logins: ${CUSTOMERS.map(c => c.email).join(', ')}`);
};

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import bcrypt from 'bcryptjs';
import { addDays, addHours, setHours, startOfDay } from 'date-fns';
import type { BookingStatus } from '@prisma/client';
import { prisma } from '../../src/config/prisma';

export const TEST_PASSWORD = 'Passw0rd-test';

const TABLES = [
  'notifications',
  'booking_status_history',
  'bookings',
  'time_slots',
  'dealership_vehicles',
  'vehicle_images',
  'vehicles',
  'dealerships',
  'users',
];

export const resetDatabase = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map(t => `"${t}"`).join(', ')} CASCADE`);
};

export const seedMinimalData = async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const staff = await prisma.user.create({
    data: {
      email: 'staff@example.test',
      passwordHash,
      role: 'STAFF',
      firstName: 'Eleanor',
      lastName: 'Whitfield',
      phone: '+44 20 7946 0101',
    },
  });
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.test',
      passwordHash,
      role: 'CUSTOMER',
      firstName: 'Amelia',
      lastName: 'Hart',
      phone: '+44 7700 900111',
    },
  });
  const dealership = await prisma.dealership.create({
    data: {
      name: 'Prestige Mayfair',
      address: '14 Berkeley Square',
      city: 'London',
      phone: '+44 20 7946 1000',
      email: 'mayfair@example.test',
      openingHours: 'Mon-Sat 09:00-18:00',
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: {
      manufacturer: 'Porsche',
      model: '911 Carrera T',
      year: 2025,
      vehicleType: 'COUPE',
      fuelType: 'PETROL',
      transmission: 'MANUAL',
      engine: '3.0L twin-turbo flat-six',
      powerHp: 389,
      seats: 4,
      color: 'Gentian Blue',
      description: 'A purist 911 with a seven-speed manual gearbox.',
      features: ['Sport Chrono package'],
    },
  });
  await prisma.dealershipVehicle.create({
    data: { dealershipId: dealership.id, vehicleId: vehicle.id },
  });
  const startAt = setHours(startOfDay(addDays(new Date(), 3)), 10);
  const slot = await prisma.timeSlot.create({
    data: {
      dealershipId: dealership.id,
      vehicleId: vehicle.id,
      startAt,
      endAt: addHours(startAt, 1),
      createdById: staff.id,
    },
  });
  return { staff, customer, dealership, vehicle, slot };
};

interface SeededData {
  staff: { id: string };
  dealership: { id: string };
  vehicle: { id: string };
}

export const createCustomer = async (
  email: string,
  firstName: string,
  lastName: string,
  phone: string,
) =>
  prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      role: 'CUSTOMER',
      firstName,
      lastName,
      phone,
    },
  });

export const createSlot = (data: SeededData, daysFromNow: number, hour: number) => {
  const startAt = setHours(startOfDay(addDays(new Date(), daysFromNow)), hour);
  return prisma.timeSlot.create({
    data: {
      dealershipId: data.dealership.id,
      vehicleId: data.vehicle.id,
      startAt,
      endAt: addHours(startAt, 1),
      createdById: data.staff.id,
    },
  });
};

export const createBooking = (
  customerId: string,
  slotId: string,
  status: BookingStatus = 'PENDING',
) => prisma.booking.create({ data: { customerId, slotId, status } });

export const createDealership = (
  name: string,
  city: string,
  overrides: Record<string, unknown> = {},
) =>
  prisma.dealership.create({
    data: {
      name,
      city,
      address: '82 Deansgate',
      phone: '+44 161 496 2000',
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.test`,
      openingHours: 'Mon-Sat 09:00-18:00',
      ...overrides,
    },
  });

export const linkVehicle = (dealershipId: string, vehicleId: string, isAvailable = true) =>
  prisma.dealershipVehicle.create({ data: { dealershipId, vehicleId, isAvailable } });

export const createVehicle = (overrides: Record<string, unknown> = {}) =>
  prisma.vehicle.create({
    data: {
      manufacturer: 'Bentley',
      model: 'Continental GT Speed',
      year: 2025,
      vehicleType: 'GRAND_TOURER',
      fuelType: 'PETROL',
      transmission: 'DUAL_CLUTCH',
      engine: '6.0L twin-turbo W12',
      powerHp: 650,
      seats: 4,
      color: 'Verdant Green',
      description: 'Hand-crafted in Crewe with a thunderous W12 engine.',
      features: ['Naim for Bentley audio'],
      ...overrides,
    },
  });

interface SlotTarget {
  staff: { id: string };
  dealership: { id: string };
  vehicle: { id: string };
}

export const createBookingAt = async (options: {
  customerId: string;
  target: SlotTarget;
  status: BookingStatus;
  slotStart: Date;
  slotEnd?: Date;
  createdAt?: Date;
}) => {
  const slot = await prisma.timeSlot.create({
    data: {
      dealershipId: options.target.dealership.id,
      vehicleId: options.target.vehicle.id,
      startAt: options.slotStart,
      endAt: options.slotEnd ?? addHours(options.slotStart, 1),
      createdById: options.target.staff.id,
    },
  });
  return prisma.booking.create({
    data: {
      customerId: options.customerId,
      slotId: slot.id,
      status: options.status,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });
};

import type { Prisma } from '@prisma/client';

export const lockUser = (tx: Prisma.TransactionClient, id: string): Promise<unknown> =>
  tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR NO KEY UPDATE`;

export const lockDealership = (tx: Prisma.TransactionClient, id: string): Promise<unknown> =>
  tx.$queryRaw`SELECT id FROM dealerships WHERE id = ${id}::uuid FOR NO KEY UPDATE`;

export const lockVehicle = (tx: Prisma.TransactionClient, id: string): Promise<unknown> =>
  tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${id}::uuid FOR NO KEY UPDATE`;

export const lockSlot = (tx: Prisma.TransactionClient, id: string): Promise<unknown> =>
  tx.$queryRaw`SELECT id FROM time_slots WHERE id = ${id}::uuid FOR NO KEY UPDATE`;

export const lockBooking = (tx: Prisma.TransactionClient, id: string): Promise<unknown> =>
  tx.$queryRaw`SELECT id FROM bookings WHERE id = ${id}::uuid FOR NO KEY UPDATE`;

export const lockVehicleShared = (tx: Prisma.TransactionClient, id: string): Promise<unknown> =>
  tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${id}::uuid FOR SHARE`;

export const lockDealershipShared = (tx: Prisma.TransactionClient, id: string): Promise<unknown> =>
  tx.$queryRaw`SELECT id FROM dealerships WHERE id = ${id}::uuid FOR SHARE`;

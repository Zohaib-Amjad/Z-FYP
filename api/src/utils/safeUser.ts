import type { Prisma } from '@prisma/client';

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  drivingLicenseNumber: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;

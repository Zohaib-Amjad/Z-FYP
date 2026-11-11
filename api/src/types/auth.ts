import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: Role;
}

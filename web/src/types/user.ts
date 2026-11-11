export type Role = 'CUSTOMER' | 'STAFF';

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
  drivingLicenseNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

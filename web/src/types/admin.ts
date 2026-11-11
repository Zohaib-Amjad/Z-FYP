import type { BookingHistoryEntry as CustomerHistoryEntry, BookingStatus } from './booking';

/** Admin API shapes; mirrors api/openapi.yaml (Admin - Bookings, Admin - Dashboard). */

export interface AdminBooking {
  id: string;
  status: BookingStatus;
  customerNote: string | null;
  staffNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  cancelledBy: 'CUSTOMER' | 'STAFF' | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    name: string;
  };
  slot: { id: string; startAt: string; endAt: string };
  vehicle: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    name: string;
    primaryImage: { url: string; altText: string | null } | null;
  };
  dealership: { id: string; name: string; address: string; city: string; phone: string };
}

interface AdminHistoryEntry extends Omit<CustomerHistoryEntry, 'changedBy'> {
  changedBy: { id: string; name: string; role: 'CUSTOMER' | 'STAFF' } | null;
}

export interface AdminBookingDetail extends Omit<
  AdminBooking,
  'customer' | 'slot' | 'vehicle' | 'dealership'
> {
  customer: AdminBooking['customer'] & {
    drivingLicenseNumber: string | null;
    isActive: boolean;
    createdAt: string;
  };
  slot: AdminBooking['slot'] & { isActive: boolean };
  vehicle: AdminBooking['vehicle'] & {
    vehicleType: string;
    fuelType: string;
    transmission: string;
    color: string | null;
  };
  dealership: AdminBooking['dealership'] & { email: string; openingHours: string };
  statusHistory: AdminHistoryEntry[];
}

export interface DashboardSummary {
  generatedAt: string;
  timeZone: string;
  pending: number;
  todaysTestDrives: number;
  next7Days: number;
  approvedUpcoming: number;
  completedThisMonth: number;
  cancelledThisMonth: number;
  rejectedThisMonth: number;
  totalCustomers: number;
  activeVehicles: number;
  activeDealerships: number;
  freeSlotsNext7Days: number;
  needsAttention: {
    pendingOlderThan24h: { count: number; items: AdminBooking[] };
    pastNotCompleted: { count: number; items: AdminBooking[] };
  };
}

interface TrendPoint {
  date: string;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  total: number;
}

export interface BookingsTrend {
  days: number;
  timeZone: string;
  from: string;
  to: string;
  points: TrendPoint[];
}

interface TopVehicle {
  vehicle: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    isActive: boolean;
    name: string;
    primaryImage: { url: string; altText: string | null } | null;
  };
  requests: number;
}

export interface TopVehicles {
  days: number;
  since: string;
  items: TopVehicle[];
}

export type BookingAction = 'approve' | 'reject' | 'reschedule' | 'cancel' | 'complete';

/* ------------------------------------------------- catalogue management */

export interface AdminVehicleImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface AdminVehicle {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  vehicleType: string;
  fuelType: string;
  transmission: string;
  engine: string | null;
  powerHp: number | null;
  topSpeedKmh: number | null;
  acceleration0to100: number | null;
  seats: number | null;
  color: string | null;
  priceFrom: number | null;
  description: string | null;
  features: string[];
  availabilityNote: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  primaryImage: AdminVehicleImage | null;
  dealershipCount: number;
}

export interface VehicleDealershipLink {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
  isAvailable: boolean;
}

export interface AdminVehicleDetail extends Omit<AdminVehicle, 'primaryImage' | 'dealershipCount'> {
  images: AdminVehicleImage[];
  dealerships: VehicleDealershipLink[];
  upcomingActiveBookingCount: number;
}

export interface AdminDealership {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  openingHours: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  vehicleCount: number;
  upcomingActiveBookingCount?: number;
}

export interface AdminSlot {
  id: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
  createdAt: string;
  dealership: { id: string; name: string; city: string };
  vehicle: { id: string; manufacturer: string; model: string };
  activeBooking: {
    id: string;
    status: BookingStatus;
    customer: { id: string; firstName: string; lastName: string; email: string };
  } | null;
}

export interface BulkSlotResult {
  dryRun: boolean;
  slots: { startAt: string; endAt: string }[];
  skipped: {
    startAt: string;
    endAt: string;
    reason: 'IN_PAST' | 'OVERLAPS_EXISTING';
    clashingSlot?: { id: string; startAt: string; endAt: string };
  }[];
  totals: { candidates: number; slots: number; skipped: number };
}

export interface Customer {
  id: string;
  email: string;
  role: 'CUSTOMER';
  firstName: string;
  lastName: string;
  phone: string | null;
  drivingLicenseNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  bookingCount?: number;
  lastBookingAt?: string | null;
}

export interface CustomerDetail {
  customer: Customer;
  summary: { total: number; byStatus: Partial<Record<BookingStatus, number>> };
  bookings: {
    id: string;
    status: BookingStatus;
    createdAt: string;
    slot: {
      startAt: string;
      endAt: string;
      vehicle: { id: string; manufacturer: string; model: string };
      dealership: { id: string; name: string; city: string };
    };
  }[];
}

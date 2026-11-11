export const BOOKING_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'RESCHEDULED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const NOTIFICATION_TYPES = [
  'BOOKING_CREATED',
  'BOOKING_APPROVED',
  'BOOKING_REJECTED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  bookingId: string | null;
}

export interface SlotPreview {
  id: string;
  startAt: string;
  endAt: string;
  isAvailable: boolean;
  cancellationWindowHours: number;
  dealership: {
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    openingHours: string;
  };
  vehicle: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    primaryImage: {
      id: string;
      url: string;
      altText: string | null;
      isPrimary: boolean;
      sortOrder: number;
    } | null;
  };
}

export const MY_BOOKING_VIEWS = [
  'pending',
  'upcoming',
  'completed',
  'cancelled',
  'previous',
  'all',
] as const;

export type MyBookingView = (typeof MY_BOOKING_VIEWS)[number];

export type BookingCounts = Record<MyBookingView, number>;

/** One of the customer's own bookings (list item). */
export interface MyBooking {
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
  slotId: string;
  startAt: string;
  endAt: string;
  vehicle: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    name: string;
    primaryImage: { url: string; altText: string | null } | null;
  };
  dealership: {
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    openingHours: string;
  };
  canCancel: boolean;
  cancelBlockedReason: string | null;
}

export interface HistorySlot {
  id: string;
  startAt: string;
  endAt: string;
  dealership: { id: string; name: string };
}

export interface BookingHistoryEntry {
  id: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  action: string;
  note: string | null;
  createdAt: string;
  oldSlot: HistorySlot | null;
  newSlot: HistorySlot | null;
  changedBy: { role: 'CUSTOMER' | 'STAFF'; label: string };
}

export interface MyBookingDetail extends MyBooking {
  statusHistory: BookingHistoryEntry[];
}

/** The booking returned when a test drive is requested. */
export interface Booking {
  id: string;
  status: BookingStatus;
  customerNote: string | null;
  createdAt: string;
  slot: { id: string; startAt: string; endAt: string };
  vehicle: { id: string; manufacturer: string; model: string; year: number };
  dealership: { id: string; name: string; address: string; city: string; phone: string };
}

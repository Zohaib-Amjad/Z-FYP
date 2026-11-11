import { STATUS_LABELS } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/format';
import type {
  BookingCounts,
  BookingHistoryEntry,
  HistorySlot,
  MyBooking,
  MyBookingView,
  Page,
} from '@/types';
import { MY_BOOKING_VIEWS } from '@/types';

export interface ViewTab {
  id: MyBookingView;
  label: string;
  emptyTitle: string;
  emptyText: string;
}

export const VIEW_TABS: ViewTab[] = [
  {
    id: 'upcoming',
    label: 'Upcoming',
    emptyTitle: 'No upcoming test drives',
    emptyText:
      'Approved and rescheduled appointments appear here. Browse the collection to arrange one.',
  },
  {
    id: 'pending',
    label: 'Pending',
    emptyTitle: 'Nothing awaiting approval',
    emptyText: 'Requests that our showroom team is still reviewing appear here.',
  },
  {
    id: 'completed',
    label: 'Completed',
    emptyTitle: 'No completed test drives yet',
    emptyText: 'Once you have taken a drive, it is kept here for your records.',
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    emptyTitle: 'No cancelled or declined requests',
    emptyText: 'Cancelled bookings and requests the showroom could not accommodate appear here.',
  },
  {
    id: 'previous',
    label: 'Previous',
    emptyTitle: 'No past appointments',
    emptyText: 'Appointments whose time has passed appear here.',
  },
  {
    id: 'all',
    label: 'All',
    emptyTitle: 'You have not booked a test drive yet',
    emptyText: 'Choose a vehicle and a time that suits you, and we will take care of the rest.',
  },
];

const DEFAULT_VIEW: MyBookingView = 'upcoming';

export function parseView(value: string | null): MyBookingView {
  return MY_BOOKING_VIEWS.find(view => view === value) ?? DEFAULT_VIEW;
}

const ACTIVE = new Set(['PENDING', 'APPROVED', 'RESCHEDULED']);

/**
 * Counts after a customer cancels a booking of the given status: the booking leaves the tab it
 * was in (pending, or upcoming) and joins cancelled. "All" and "previous" do not change.
 */
export function countsAfterCancel(
  counts: BookingCounts,
  status: MyBooking['status'],
): BookingCounts {
  if (!ACTIVE.has(status)) return counts;
  const from = status === 'PENDING' ? 'pending' : 'upcoming';
  return {
    ...counts,
    [from]: Math.max(0, counts[from] - 1),
    cancelled: counts.cancelled + 1,
  };
}

/** The booking as it will look once cancelled, for the optimistic update. */
export function asCancelled(booking: MyBooking, reason: string | null): MyBooking {
  return {
    ...booking,
    status: 'CANCELLED',
    cancellationReason: reason,
    cancelledBy: 'CUSTOMER',
    canCancel: false,
    cancelBlockedReason: null,
  };
}

/** Applies an optimistic cancel to one cached list page for a given tab. */
export function pageAfterCancel(
  page: Page<MyBooking>,
  view: MyBookingView,
  bookingId: string,
  reason: string | null,
): Page<MyBooking> {
  const target = page.items.find(item => item.id === bookingId);
  if (!target) return page;
  if (view === 'pending' || view === 'upcoming') {
    return {
      ...page,
      items: page.items.filter(item => item.id !== bookingId),
      total: Math.max(0, page.total - 1),
    };
  }
  if (view === 'cancelled') return { ...page, total: page.total + 1 };
  return {
    ...page,
    items: page.items.map(item => (item.id === bookingId ? asCancelled(item, reason) : item)),
  };
}

const HEADLINES: Record<string, string> = {
  CREATED: 'Request submitted',
  APPROVED: 'Approved by the showroom',
  REJECTED: 'Declined by the showroom',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Moved to a new time',
  COMPLETED: 'Test drive completed',
};

export function historyHeadline(entry: Pick<BookingHistoryEntry, 'action' | 'toStatus'>): string {
  return HEADLINES[entry.action] ?? STATUS_LABELS[entry.toStatus];
}

/** "Mon 10 Nov 2026, 10:00 at Prestige Mayfair" for a slot in a timeline entry. */
export function describeSlot(slot: HistorySlot): string {
  return `${formatDateTime(slot.startAt)} at ${slot.dealership.name}`;
}

/** Why a booking is in its current state, when the showroom or customer left a reason. */
export function statusExplanation(booking: MyBooking): { label: string; text: string } | null {
  if (booking.status === 'REJECTED' && booking.rejectionReason) {
    return { label: 'Reason from the showroom', text: booking.rejectionReason };
  }
  if (booking.status === 'CANCELLED' && booking.cancellationReason) {
    const who = booking.cancelledBy === 'STAFF' ? 'the showroom' : 'you';
    return { label: `Cancelled by ${who}`, text: booking.cancellationReason };
  }
  if (booking.staffNote) return { label: 'Note from the showroom', text: booking.staffNote };
  return null;
}

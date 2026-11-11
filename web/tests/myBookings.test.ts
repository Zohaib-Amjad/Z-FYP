import { describe, expect, it } from 'vitest';
import {
  VIEW_TABS,
  asCancelled,
  countsAfterCancel,
  historyHeadline,
  pageAfterCancel,
  parseView,
  statusExplanation,
} from '@/lib/myBookings';
import type { BookingCounts, BookingHistoryEntry, MyBooking, Page } from '@/types';

const booking = (overrides: Partial<MyBooking> = {}): MyBooking =>
  ({
    id: 'b1',
    status: 'APPROVED',
    customerNote: null,
    staffNote: null,
    rejectionReason: null,
    cancellationReason: null,
    cancelledBy: null,
    canCancel: true,
    cancelBlockedReason: null,
    ...overrides,
  }) as MyBooking;

const page = (items: MyBooking[], total = items.length): Page<MyBooking> => ({
  items,
  page: 1,
  pageSize: 10,
  total,
  totalPages: 1,
});

const counts: BookingCounts = {
  pending: 2,
  upcoming: 3,
  completed: 1,
  cancelled: 4,
  previous: 5,
  all: 15,
};

describe('parseView', () => {
  it('accepts known views and falls back to upcoming', () => {
    expect(parseView('cancelled')).toBe('cancelled');
    expect(parseView('all')).toBe('all');
    expect(parseView('nonsense')).toBe('upcoming');
    expect(parseView(null)).toBe('upcoming');
  });

  it('has a tab with helpful empty-state copy for every view', () => {
    expect(VIEW_TABS.map(tab => tab.id).sort()).toEqual([
      'all',
      'cancelled',
      'completed',
      'pending',
      'previous',
      'upcoming',
    ]);
    expect(VIEW_TABS.every(tab => tab.emptyTitle && tab.emptyText)).toBe(true);
  });
});

describe('countsAfterCancel', () => {
  it('moves a pending booking from pending to cancelled', () => {
    expect(countsAfterCancel(counts, 'PENDING')).toEqual({ ...counts, pending: 1, cancelled: 5 });
  });

  it.each(['APPROVED', 'RESCHEDULED'] as const)(
    'moves a %s booking from upcoming to cancelled',
    status => {
      expect(countsAfterCancel(counts, status)).toEqual({ ...counts, upcoming: 2, cancelled: 5 });
    },
  );

  it('never goes below zero and ignores final statuses', () => {
    expect(countsAfterCancel({ ...counts, pending: 0 }, 'PENDING').pending).toBe(0);
    expect(countsAfterCancel(counts, 'COMPLETED')).toBe(counts);
  });
});

describe('pageAfterCancel', () => {
  const list = page([booking({ id: 'b1' }), booking({ id: 'b2' })]);

  it('removes the booking from the pending and upcoming tabs', () => {
    for (const view of ['pending', 'upcoming'] as const) {
      const next = pageAfterCancel(list, view, 'b1', null);
      expect(next.items.map(item => item.id)).toEqual(['b2']);
      expect(next.total).toBe(1);
    }
  });

  it('updates the booking in place on the all and previous tabs', () => {
    const next = pageAfterCancel(list, 'all', 'b1', 'Plans changed');
    expect(next.items[0]).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Plans changed',
      cancelledBy: 'CUSTOMER',
      canCancel: false,
    });
    expect(next.items[1].status).toBe('APPROVED');
  });

  it('only bumps the total on the cancelled tab and leaves unrelated pages untouched', () => {
    expect(pageAfterCancel(list, 'cancelled', 'b1', null).total).toBe(3);
    expect(pageAfterCancel(list, 'upcoming', 'missing', null)).toBe(list);
  });
});

describe('asCancelled', () => {
  it('does not mutate the original', () => {
    const original = booking();
    asCancelled(original, 'x');
    expect(original.status).toBe('APPROVED');
  });
});

describe('timeline and explanations', () => {
  const entry = (action: string, toStatus: BookingHistoryEntry['toStatus']) =>
    ({ action, toStatus }) as BookingHistoryEntry;

  it('gives every action a readable headline', () => {
    expect(historyHeadline(entry('CREATED', 'PENDING'))).toBe('Request submitted');
    expect(historyHeadline(entry('RESCHEDULED', 'RESCHEDULED'))).toBe('Moved to a new time');
    expect(historyHeadline(entry('SOMETHING_NEW', 'COMPLETED'))).toBe('Completed');
  });

  it('explains rejections, cancellations and staff notes', () => {
    expect(
      statusExplanation(booking({ status: 'REJECTED', rejectionReason: 'Vehicle in service' })),
    ).toEqual({
      label: 'Reason from the showroom',
      text: 'Vehicle in service',
    });
    expect(
      statusExplanation(
        booking({ status: 'CANCELLED', cancellationReason: 'Away', cancelledBy: 'CUSTOMER' }),
      )?.label,
    ).toBe('Cancelled by you');
    expect(
      statusExplanation(
        booking({ status: 'CANCELLED', cancellationReason: 'Recall', cancelledBy: 'STAFF' }),
      )?.label,
    ).toBe('Cancelled by the showroom');
    expect(statusExplanation(booking({ staffNote: 'See you then' }))?.label).toBe(
      'Note from the showroom',
    );
    expect(statusExplanation(booking())).toBeNull();
  });
});

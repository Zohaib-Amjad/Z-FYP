import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_FILTERS,
  actionPayload,
  applyAdminChange,
  bookingActions,
  buildKpis,
  parseAdminFilters,
  statusAfter,
  toAdminApiQuery,
  toAdminSearchParams,
  validateActionText,
  withStatusAfter,
} from '@/lib/adminBookings';
import { ApiError } from '@/lib/api';
import { describeAdminActionProblem } from '@/lib/booking';
import type { BookingAction, BookingStatus, DashboardSummary } from '@/types';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const FUTURE = '2026-11-12T10:00:00.000Z';
const PAST = '2026-11-09T10:00:00.000Z';

const allowedFor = (status: BookingStatus, slot = FUTURE): BookingAction[] =>
  bookingActions(status, slot, NOW)
    .filter(state => state.allowed)
    .map(state => state.action);

describe('bookingActions (A2 state machine)', () => {
  it('lets staff decide on a pending request', () => {
    expect(allowedFor('PENDING')).toEqual(['approve', 'reject', 'reschedule', 'cancel']);
  });

  it('lets staff reschedule or cancel an approved booking, and complete it once the time has passed', () => {
    expect(allowedFor('APPROVED')).toEqual(['reschedule', 'cancel']);
    expect(allowedFor('APPROVED', PAST)).toEqual(['reschedule', 'cancel', 'complete']);
  });

  it('allows a rescheduled booking to be rescheduled again, cancelled or completed', () => {
    expect(allowedFor('RESCHEDULED')).toEqual(['reschedule', 'cancel']);
    expect(allowedFor('RESCHEDULED', PAST)).toEqual(['reschedule', 'cancel', 'complete']);
  });

  it.each(['REJECTED', 'CANCELLED', 'COMPLETED'] as const)(
    'allows nothing on a %s booking',
    status => {
      expect(allowedFor(status, PAST)).toEqual([]);
      const reasons = bookingActions(status, PAST, NOW).map(state => state.reason);
      expect(reasons.every(reason => reason?.includes('can no longer be changed'))).toBe(true);
    },
  );

  it('explains every disabled action', () => {
    const states = bookingActions('APPROVED', FUTURE, NOW);
    const approve = states.find(state => state.action === 'approve');
    const complete = states.find(state => state.action === 'complete');

    expect(approve?.reason).toMatch(/Only pending requests can be approved/);
    expect(complete?.reason).toMatch(/start time has passed/);
    expect(states.filter(state => state.allowed).every(state => state.reason === undefined)).toBe(
      true,
    );
  });

  it('treats a slot starting exactly now as started', () => {
    expect(allowedFor('APPROVED', NOW.toISOString())).toContain('complete');
  });
});

const params = (query: string) => new URLSearchParams(query);

describe('admin filters', () => {
  it('parses valid filters and drops invalid ones', () => {
    const filters = parseAdminFilters(
      params(
        'status=PENDING,APPROVED,BOGUS,PENDING&dealershipId=3b2eeacc-b2df-4b3d-a64c-4177a9369608&vehicleId=nope&dateFrom=2026-11-01&dateTo=11/02&q=hart&sort=slotStartAsc&page=2',
      ),
    );

    expect(filters).toEqual({
      status: ['PENDING', 'APPROVED'],
      dealershipId: '3b2eeacc-b2df-4b3d-a64c-4177a9369608',
      vehicleId: '',
      dateFrom: '2026-11-01',
      dateTo: '',
      q: 'hart',
      sort: 'slotStartAsc',
      page: 2,
    });
    expect(parseAdminFilters(params(''))).toEqual(DEFAULT_ADMIN_FILTERS);
  });

  it('round-trips through the URL and omits defaults', () => {
    const filters = applyAdminChange(DEFAULT_ADMIN_FILTERS, {
      status: ['PENDING'],
      q: 'range',
      sort: 'slotStartDesc',
    });
    const query = toAdminSearchParams(filters).toString();

    expect(query).toBe('status=PENDING&q=range&sort=slotStartDesc');
    expect(parseAdminFilters(params(query))).toEqual(filters);
    expect(toAdminSearchParams(DEFAULT_ADMIN_FILTERS).toString()).toBe('');
  });

  it('returns to page 1 when a filter changes', () => {
    expect(applyAdminChange({ ...DEFAULT_ADMIN_FILTERS, page: 4 }, { q: 'x' }).page).toBe(1);
    expect(applyAdminChange({ ...DEFAULT_ADMIN_FILTERS, page: 4 }, { page: 5 }).page).toBe(5);
  });

  it('sends local calendar days as whole-day UTC instants and joins statuses', () => {
    const query = toAdminApiQuery({
      ...DEFAULT_ADMIN_FILTERS,
      status: ['PENDING', 'APPROVED'],
      dateFrom: '2026-11-10',
      dateTo: '2026-11-10',
      q: '  hart ',
    });

    expect(query.status).toBe('PENDING,APPROVED');
    expect(query.q).toBe('hart');
    const from = new Date(query.dateFrom as string);
    const to = new Date(query.dateTo as string);
    expect(from.getHours()).toBe(0);
    expect(to.getHours()).toBe(23);
    expect(to.getTime() - from.getTime()).toBeGreaterThan(23 * 3_600_000);
    expect(query.pageSize).toBe(15);
  });

  it('omits empty filters from the API query', () => {
    const query = toAdminApiQuery(DEFAULT_ADMIN_FILTERS);
    expect(query.status).toBeUndefined();
    expect(query.dateFrom).toBeUndefined();
    expect(query.q).toBeUndefined();
  });
});

describe('buildKpis', () => {
  const summary = {
    pending: 3,
    todaysTestDrives: 2,
    next7Days: 5,
    completedThisMonth: 7,
    cancelledThisMonth: 1,
    freeSlotsNext7Days: 120,
    activeVehicles: 12,
    totalCustomers: 40,
  } as DashboardSummary;
  const kpis = buildKpis(summary, new Date(2026, 10, 10, 12));

  it('has the eight cards in order with their values', () => {
    expect(kpis.map(kpi => kpi.value)).toEqual([3, 2, 5, 7, 1, 120, 12, 40]);
  });

  it('links booking cards to pre-filtered lists the list page can parse', () => {
    const pending = kpis.find(kpi => kpi.id === 'pending')!;
    const next7 = kpis.find(kpi => kpi.id === 'next7')!;

    expect(parseAdminFilters(new URL(pending.href, 'http://x').searchParams)).toMatchObject({
      status: ['PENDING'],
    });
    expect(parseAdminFilters(new URL(next7.href, 'http://x').searchParams)).toMatchObject({
      status: ['APPROVED', 'RESCHEDULED'],
      dateFrom: '2026-11-10',
      dateTo: '2026-11-17',
    });
  });

  it('links the non-booking cards to their own sections and highlights pending work', () => {
    expect(kpis.find(kpi => kpi.id === 'vehicles')?.href).toBe('/admin/vehicles');
    expect(kpis.find(kpi => kpi.id === 'customers')?.href).toBe('/admin/customers');
    expect(kpis.find(kpi => kpi.id === 'pending')?.highlight).toBe(true);
    expect(buildKpis({ ...summary, pending: 0 }).find(kpi => kpi.id === 'pending')?.highlight).toBe(
      false,
    );
  });
});

describe('action payloads and optimistic status', () => {
  it('maps each action to the status it leads to', () => {
    expect(
      (['approve', 'reject', 'reschedule', 'cancel', 'complete'] as const).map(statusAfter),
    ).toEqual(['APPROVED', 'REJECTED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED']);
  });

  it('builds the request body the API expects for every action', () => {
    expect(actionPayload('approve', { text: ' See you then ' })).toEqual({
      staffNote: 'See you then',
    });
    expect(actionPayload('approve', {})).toEqual({ staffNote: null });
    expect(actionPayload('reject', { text: 'Vehicle in service' })).toEqual({
      rejectionReason: 'Vehicle in service',
    });
    expect(actionPayload('cancel', { text: 'Recall notice' })).toEqual({
      cancellationReason: 'Recall notice',
    });
    expect(actionPayload('complete', { text: '' })).toEqual({ staffNote: null });
    expect(actionPayload('reschedule', { newSlotId: 's1', text: 'Service' })).toEqual({
      newSlotId: 's1',
      note: 'Service',
    });
  });

  it('moves a booking to its new status without mutating the original', () => {
    const original = { id: 'b1', status: 'PENDING' as const };
    expect(withStatusAfter(original, 'approve').status).toBe('APPROVED');
    expect(original.status).toBe('PENDING');
  });

  it('requires a reason for reject and cancel only', () => {
    expect(validateActionText('reject', '   ')).toMatch(/reason of at least 5/);
    expect(validateActionText('cancel', 'abcd')).toMatch(/at least 5/);
    expect(validateActionText('reject', 'Vehicle unavailable')).toBeNull();
    expect(validateActionText('approve', '')).toBeNull();
    expect(validateActionText('complete', '')).toBeNull();
    expect(validateActionText('approve', 'x'.repeat(501))).toMatch(/at most 500/);
  });
});

describe('describeAdminActionProblem', () => {
  it('explains a stale booking and a taken slot without error codes', () => {
    const stale = describeAdminActionProblem(new ApiError(409, 'INVALID_STATUS_TRANSITION', 'raw'));
    expect(stale).toMatch(/changed by someone else/);
    expect(stale).not.toMatch(/INVALID_STATUS_TRANSITION|raw/);
    expect(describeAdminActionProblem(new ApiError(409, 'SLOT_UNAVAILABLE', 'x'))).toMatch(
      /just been taken/,
    );
    expect(describeAdminActionProblem(new ApiError(409, 'BOOKING_CONFLICT', 'x'))).toMatch(
      /overlaps/,
    );
  });

  it('surfaces the first validation message and falls back for anything else', () => {
    const invalid = new ApiError(422, 'VALIDATION_ERROR', 'x', [
      { field: 'newSlotId', message: 'Choose a slot' },
    ]);
    expect(describeAdminActionProblem(invalid)).toBe('Choose a slot');
    expect(describeAdminActionProblem(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toMatch(
      /try again/,
    );
    expect(describeAdminActionProblem(new Error('boom'))).toMatch(/try again/);
  });
});

import { addDays, endOfDay, format, startOfDay, startOfMonth } from 'date-fns';
import {
  BOOKING_STATUSES,
  type BookingAction,
  type BookingStatus,
  type DashboardSummary,
} from '@/types';

/* ---------------------------------------------------------------- actions */

export interface ActionState {
  action: BookingAction;
  label: string;
  allowed: boolean;
  /** Why the action is unavailable; shown as a tooltip and to screen readers. */
  reason?: string;
}

const ACTION_LABELS: Record<BookingAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
  complete: 'Complete',
};

const ACTION_ORDER: BookingAction[] = ['approve', 'reject', 'reschedule', 'cancel', 'complete'];

const FROM: Record<BookingAction, BookingStatus[]> = {
  approve: ['PENDING'],
  reject: ['PENDING'],
  reschedule: ['PENDING', 'APPROVED', 'RESCHEDULED'],
  cancel: ['PENDING', 'APPROVED', 'RESCHEDULED'],
  complete: ['APPROVED', 'RESCHEDULED'],
};

const FINAL: BookingStatus[] = ['REJECTED', 'CANCELLED', 'COMPLETED'];

const STATUS_WORDS: Record<BookingStatus, string> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  RESCHEDULED: 'rescheduled',
};

function blockedReason(
  action: BookingAction,
  status: BookingStatus,
  slotStartAt: string,
  now: Date,
): string | undefined {
  if (FINAL.includes(status)) {
    return `This booking is ${STATUS_WORDS[status]} and can no longer be changed.`;
  }
  if (!FROM[action].includes(status)) {
    if (action === 'approve' || action === 'reject') {
      return `Only pending requests can be ${action === 'approve' ? 'approved' : 'rejected'}; this one is ${STATUS_WORDS[status]}.`;
    }
    return `A ${STATUS_WORDS[status]} booking cannot be ${action === 'complete' ? 'completed' : 'changed'} this way.`;
  }
  if (action === 'complete' && new Date(slotStartAt).getTime() > now.getTime()) {
    return 'A test drive can only be completed once its start time has passed.';
  }
  return undefined;
}

/** Which of the five staff actions apply to a booking right now (A2), and why not when they do not. */
export function bookingActions(
  status: BookingStatus,
  slotStartAt: string,
  now: Date = new Date(),
): ActionState[] {
  return ACTION_ORDER.map(action => {
    const reason = blockedReason(action, status, slotStartAt, now);
    return { action, label: ACTION_LABELS[action], allowed: reason === undefined, reason };
  });
}

/* ---------------------------------------------------------------- filters */

export const ADMIN_SORTS = [
  { value: 'createdDesc', label: 'Newest requests' },
  { value: 'slotStartAsc', label: 'Appointment: soonest first' },
  { value: 'slotStartDesc', label: 'Appointment: latest first' },
] as const;

export type AdminSort = (typeof ADMIN_SORTS)[number]['value'];

export interface AdminFilters {
  status: BookingStatus[];
  dealershipId: string;
  vehicleId: string;
  /** Local calendar dates, yyyy-MM-dd. */
  dateFrom: string;
  dateTo: string;
  q: string;
  sort: AdminSort;
  page: number;
}

export const DEFAULT_ADMIN_FILTERS: AdminFilters = {
  status: [],
  dealershipId: '',
  vehicleId: '',
  dateFrom: '',
  dateTo: '',
  q: '',
  sort: 'createdDesc',
  page: 1,
};

type RawParams = { get: (name: string) => string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAdminFilters(params: RawParams): AdminFilters {
  const statuses = (params.get('status') ?? '')
    .split(',')
    .filter((value): value is BookingStatus => BOOKING_STATUSES.includes(value as BookingStatus));
  const sort = ADMIN_SORTS.find(option => option.value === params.get('sort'))?.value;
  const page = Number(params.get('page'));
  const date = (name: string) => {
    const value = params.get(name);
    return value && DATE.test(value) ? value : '';
  };
  const id = (name: string) => {
    const value = params.get(name);
    return value && UUID.test(value) ? value : '';
  };
  return {
    status: [...new Set(statuses)],
    dealershipId: id('dealershipId'),
    vehicleId: id('vehicleId'),
    dateFrom: date('dateFrom'),
    dateTo: date('dateTo'),
    q: (params.get('q') ?? '').slice(0, 100),
    sort: sort ?? DEFAULT_ADMIN_FILTERS.sort,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function toAdminSearchParams(filters: AdminFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status.length > 0) params.set('status', filters.status.join(','));
  (['dealershipId', 'vehicleId', 'dateFrom', 'dateTo', 'q'] as const).forEach(key => {
    if (filters[key]) params.set(key, filters[key]);
  });
  if (filters.sort !== DEFAULT_ADMIN_FILTERS.sort) params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const ADMIN_PAGE_SIZE = 15;

/** Dates are chosen as local calendar days and sent as the matching UTC instants. */
export function toAdminApiQuery(
  filters: AdminFilters,
): Record<string, string | number | undefined> {
  return {
    status: filters.status.length > 0 ? filters.status.join(',') : undefined,
    dealershipId: filters.dealershipId || undefined,
    vehicleId: filters.vehicleId || undefined,
    dateFrom: filters.dateFrom
      ? startOfDay(parseLocalDate(filters.dateFrom)).toISOString()
      : undefined,
    dateTo: filters.dateTo ? endOfDay(parseLocalDate(filters.dateTo)).toISOString() : undefined,
    q: filters.q.trim() || undefined,
    sort: filters.sort,
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export function applyAdminChange(
  current: AdminFilters,
  change: Partial<AdminFilters>,
): AdminFilters {
  const next = { ...current, ...change };
  if (!('page' in change)) next.page = 1;
  return next;
}

/* ------------------------------------------------------------ dashboard */

export interface Kpi {
  id: string;
  label: string;
  value: number;
  href: string;
  hint: string;
  highlight?: boolean;
}

const dayKey = (date: Date): string => format(date, 'yyyy-MM-dd');

function bookingsLink(params: Record<string, string>): string {
  return `/admin/bookings?${new URLSearchParams(params).toString()}`;
}

/** The eight dashboard cards, each linking to the matching pre-filtered list. */
export function buildKpis(summary: DashboardSummary, now: Date = new Date()): Kpi[] {
  const today = dayKey(now);
  return [
    {
      id: 'pending',
      label: 'Awaiting your decision',
      value: summary.pending,
      hint: 'Pending requests',
      href: bookingsLink({ status: 'PENDING', sort: 'slotStartAsc' }),
      highlight: summary.pending > 0,
    },
    {
      id: 'today',
      label: "Today's test drives",
      value: summary.todaysTestDrives,
      hint: 'Scheduled for today',
      href: bookingsLink({
        status: 'APPROVED,RESCHEDULED,COMPLETED',
        dateFrom: today,
        dateTo: today,
        sort: 'slotStartAsc',
      }),
    },
    {
      id: 'next7',
      label: 'Next 7 days',
      value: summary.next7Days,
      hint: 'Approved and upcoming',
      href: bookingsLink({
        status: 'APPROVED,RESCHEDULED',
        dateFrom: today,
        dateTo: dayKey(addDays(now, 7)),
        sort: 'slotStartAsc',
      }),
    },
    {
      id: 'completed',
      label: 'Completed this month',
      value: summary.completedThisMonth,
      hint: 'Test drives taken',
      href: bookingsLink({
        status: 'COMPLETED',
        dateFrom: dayKey(startOfMonth(now)),
        dateTo: today,
      }),
    },
    {
      id: 'cancelled',
      label: 'Cancelled this month',
      value: summary.cancelledThisMonth,
      hint: 'By customers or staff',
      href: bookingsLink({
        status: 'CANCELLED',
        dateFrom: dayKey(startOfMonth(now)),
        dateTo: dayKey(addDays(now, 60)),
      }),
    },
    {
      id: 'freeSlots',
      label: 'Free slots, next 7 days',
      value: summary.freeSlotsNext7Days,
      hint: 'Open appointments',
      href: '/admin/slots',
    },
    {
      id: 'vehicles',
      label: 'Active vehicles',
      value: summary.activeVehicles,
      hint: 'In the collection',
      href: '/admin/vehicles',
    },
    {
      id: 'customers',
      label: 'Customers',
      value: summary.totalCustomers,
      hint: 'Registered accounts',
      href: '/admin/customers',
    },
  ];
}

/* ------------------------------------------------------- optimistic updates */

const STATUS_AFTER: Record<BookingAction, BookingStatus> = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  reschedule: 'RESCHEDULED',
  cancel: 'CANCELLED',
  complete: 'COMPLETED',
};

export function statusAfter(action: BookingAction): BookingStatus {
  return STATUS_AFTER[action];
}

/** Request body each staff action sends; reasons are required for reject and cancel. */
export interface ActionInput {
  /** Reason for reject and cancel; optional note for approve and complete. */
  text?: string;
  /** Target slot for reschedule. */
  newSlotId?: string;
}

export function actionPayload(
  action: BookingAction,
  input: ActionInput,
): Record<string, string | null> {
  const text = input.text?.trim() || null;
  switch (action) {
    case 'approve':
    case 'complete':
      return { staffNote: text };
    case 'reject':
      return { rejectionReason: text };
    case 'cancel':
      return { cancellationReason: text };
    case 'reschedule':
      return { newSlotId: input.newSlotId ?? null, note: text };
  }
}

/** The booking with its status moved on, for the optimistic update. */
export function withStatusAfter<T extends { status: BookingStatus }>(
  item: T,
  action: BookingAction,
): T {
  return { ...item, status: statusAfter(action) };
}

const MIN_REASON_LENGTH = 5;
export const MAX_NOTE_LENGTH = 500;

/** Validation for the text field of an action dialog; returns an error message or null. */
export function validateActionText(action: BookingAction, text: string): string | null {
  const trimmed = text.trim();
  const required = action === 'reject' || action === 'cancel';
  if (required && trimmed.length < MIN_REASON_LENGTH) {
    return `Please give a reason of at least ${MIN_REASON_LENGTH} characters. The customer will see it.`;
  }
  if (trimmed.length > MAX_NOTE_LENGTH) return `This can be at most ${MAX_NOTE_LENGTH} characters.`;
  return null;
}

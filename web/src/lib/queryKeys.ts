/**
 * Query key conventions: every key starts with a domain, then a scope, then its parameters.
 * Invalidate a whole domain with `queryKeys.bookings.all`, one list with its `list(...)` key.
 */
type Params = Record<string, unknown>;

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const,
  },
  vehicles: {
    all: ['vehicles'] as const,
    list: (params: Params) => ['vehicles', 'list', params] as const,
    detail: (id: string) => ['vehicles', 'detail', id] as const,
    filters: () => ['vehicles', 'filters'] as const,
    slots: (id: string, params: Params) => ['vehicles', 'slots', id, params] as const,
  },
  dealerships: {
    all: ['dealerships'] as const,
    list: () => ['dealerships', 'list'] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    mine: (params: Params) => ['bookings', 'mine', params] as const,
    counts: () => ['bookings', 'counts'] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params: Params) => ['notifications', 'list', params] as const,
    unread: () => ['notifications', 'unread'] as const,
  },
  admin: {
    all: ['admin'] as const,
    dashboard: (params: Params) => ['admin', 'dashboard', params] as const,
    bookings: (params: Params) => ['admin', 'bookings', params] as const,
    booking: (id: string) => ['admin', 'booking', id] as const,
    vehicles: (params: Params) => ['admin', 'vehicles', params] as const,
    vehicle: (id: string) => ['admin', 'vehicle', id] as const,
    dealerships: (params: Params) => ['admin', 'dealerships', params] as const,
    dealership: (id: string) => ['admin', 'dealership', id] as const,
    slots: (params: Params) => ['admin', 'slots', params] as const,
    slot: (id: string) => ['admin', 'slot', id] as const,
    customers: (params: Params) => ['admin', 'customers', params] as const,
    customer: (id: string) => ['admin', 'customer', id] as const,
    staff: () => ['admin', 'staff'] as const,
  },
} as const;

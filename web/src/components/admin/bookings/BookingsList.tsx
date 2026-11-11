'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { CalendarX2 } from 'lucide-react';
import { ActionButtons } from '@/components/admin/ActionButtons';
import { useBookingActionDialogs } from '@/components/admin/BookingActionDialogs';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import {
  DEFAULT_ADMIN_FILTERS,
  applyAdminChange,
  parseAdminFilters,
  toAdminApiQuery,
  toAdminSearchParams,
  type AdminFilters,
} from '@/lib/adminBookings';
import { api } from '@/lib/api';
import { formatDate, formatRelative, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminBooking, Page } from '@/types';
import { BookingFilters } from './BookingFilters';

export function BookingsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseAdminFilters(searchParams), [searchParams]);
  const { request, dialogs } = useBookingActionDialogs();

  const navigate = useCallback(
    (next: AdminFilters, mode: 'push' | 'replace' = 'push') => {
      const query = toAdminSearchParams(next).toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (mode === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router],
  );
  const change = (partial: Partial<AdminFilters>) => navigate(applyAdminChange(filters, partial));
  const search = useCallback(
    (q: string) => navigate(applyAdminChange(filters, { q }), 'replace'),
    [filters, navigate],
  );

  const apiQuery = toAdminApiQuery(filters);
  const list = useQuery({
    queryKey: queryKeys.admin.bookings(apiQuery),
    queryFn: () => api.get<Page<AdminBooking>>('/api/admin/bookings', apiQuery),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AdminBooking>[] = [
    {
      key: 'customer',
      header: 'Customer',
      cell: booking => (
        <div className="min-w-0">
          <Link
            href={`/admin/bookings/${booking.id}`}
            className="font-semibold text-ink-900 underline-offset-4 hover:underline"
          >
            {booking.customer.name}
          </Link>
          <p className="truncate text-xs text-ink-500">{booking.customer.email}</p>
        </div>
      ),
    },
    { key: 'vehicle', header: 'Vehicle', cell: booking => booking.vehicle.name },
    { key: 'dealership', header: 'Showroom', cell: booking => booking.dealership.name },
    {
      key: 'slot',
      header: 'Appointment',
      cell: booking => (
        <div>
          <p>{formatDate(booking.slot.startAt)}</p>
          <p className="text-xs text-ink-500">
            {formatTime(booking.slot.startAt)} to {formatTime(booking.slot.endAt)}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: booking => <StatusBadge status={booking.status} /> },
    {
      key: 'created',
      header: 'Requested',
      cell: booking => <span className="text-ink-600">{formatRelative(booking.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: booking => (
        <ActionButtons booking={booking} onAction={action => request(booking, action)} />
      ),
    },
  ];

  const hasFilters =
    JSON.stringify({ ...filters, page: 1, sort: 'createdDesc' }) !==
    JSON.stringify(DEFAULT_ADMIN_FILTERS);

  return (
    <div className="space-y-6">
      <BookingFilters filters={filters} onChange={change} onSearch={search} />

      <p aria-live="polite" className="text-sm font-medium text-ink-700">
        {list.data
          ? `${list.data.total} ${list.data.total === 1 ? 'booking' : 'bookings'}`
          : 'Loading bookings…'}
      </p>

      {list.isError && !list.data ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (
        <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <DataTable
            caption="Test-drive bookings"
            columns={columns}
            rows={list.data?.items ?? []}
            rowKey={booking => booking.id}
            loading={list.isPending}
            empty={
              <EmptyState
                icon={CalendarX2}
                title="No bookings match these filters"
                description={
                  hasFilters
                    ? 'Try widening the date range or clearing a filter.'
                    : 'Test-drive requests will appear here as customers make them.'
                }
                action={
                  hasFilters ? (
                    <Button
                      onClick={() => navigate({ ...DEFAULT_ADMIN_FILTERS, sort: filters.sort })}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </div>
      )}

      {list.data ? (
        <Pagination
          page={list.data.page}
          totalPages={list.data.totalPages}
          onPageChange={page => navigate(applyAdminChange(filters, { page }))}
        />
      ) : null}
      {dialogs}
    </div>
  );
}

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, panelId, tabId } from '@/components/ui/Tabs';
import { api } from '@/lib/api';
import { VIEW_TABS, parseView } from '@/lib/myBookings';
import { queryKeys } from '@/lib/queryKeys';
import type { BookingCounts, MyBooking, MyBookingView, Page } from '@/types';
import { CancelBookingDialog } from './CancelBookingDialog';
import { MyBookingCard } from './MyBookingCard';

const PAGE_SIZE = 10;
const ID_PREFIX = 'my-bookings';

export function MyBookingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get('view'));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [cancelling, setCancelling] = useState<MyBooking | null>(null);

  const go = (nextView: MyBookingView, nextPage = 1) => {
    const params = new URLSearchParams();
    params.set('view', nextView);
    if (nextPage > 1) params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const counts = useQuery({
    queryKey: queryKeys.bookings.counts(),
    queryFn: () => api.get<BookingCounts>('/api/bookings/mine/counts'),
  });

  const query = { view, page, pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: queryKeys.bookings.mine(query),
    queryFn: () => api.get<Page<MyBooking>>('/api/bookings/mine', query),
    placeholderData: keepPreviousData,
  });

  const tab = VIEW_TABS.find(candidate => candidate.id === view) ?? VIEW_TABS[0];
  const tabs = VIEW_TABS.map(item => ({
    id: item.id,
    label: item.label,
    count: counts.data?.[item.id],
  }));

  return (
    <>
      <Tabs
        items={tabs}
        value={view}
        onChange={id => go(id as MyBookingView)}
        label="Filter bookings"
        idPrefix={ID_PREFIX}
      />
      <div
        role="tabpanel"
        id={panelId(ID_PREFIX, view)}
        aria-labelledby={tabId(ID_PREFIX, view)}
        className="mt-6"
      >
        {list.isError && !list.data ? (
          <ErrorState
            title="We could not load your bookings"
            message="Please check your connection and try again."
            onRetry={() => void list.refetch()}
          />
        ) : list.isPending ? (
          <ul className="space-y-4" aria-busy="true">
            {[0, 1, 2].map(index => (
              <li key={index}>
                <Skeleton className="h-44 w-full" />
              </li>
            ))}
          </ul>
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title={tab.emptyTitle}
            description={tab.emptyText}
            action={<ButtonLink href="/vehicles">Browse vehicles</ButtonLink>}
          />
        ) : (
          <>
            <ul className={`space-y-4 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
              {list.data.items.map(booking => (
                <li key={booking.id}>
                  <MyBookingCard booking={booking} onCancel={setCancelling} />
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={list.data.page}
              totalPages={list.data.totalPages}
              onPageChange={next => go(view, next)}
            />
          </>
        )}
      </div>
      <CancelBookingDialog booking={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}

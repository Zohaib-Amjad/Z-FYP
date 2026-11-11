'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { endOfDay, startOfDay } from 'date-fns';
import { useBookingActionDialogs } from '@/components/admin/BookingActionDialogs';
import { ErrorState } from '@/components/ui/ErrorState';
import { buildKpis } from '@/lib/adminBookings';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type {
  AdminBooking,
  BookingsTrend,
  DashboardSummary,
  Page,
  TopVehicles as TopVehiclesData,
} from '@/types';
import { KpiGrid } from './KpiGrid';
import { NeedsAttention } from './NeedsAttention';
import { TodaySchedule } from './TodaySchedule';
import { TopVehicles } from './TopVehicles';
import { TrendChart } from './TrendChart';

const REFRESH_MS = 60_000;

export function DashboardView() {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const { request, dialogs } = useBookingActionDialogs();

  const summaryParams = { timeZone };
  const summary = useQuery({
    queryKey: queryKeys.admin.dashboard({ view: 'summary', ...summaryParams }),
    queryFn: () => api.get<DashboardSummary>('/api/admin/dashboard/summary', summaryParams),
    refetchInterval: REFRESH_MS,
  });

  const trendParams = { days: 14, timeZone };
  const trend = useQuery({
    queryKey: queryKeys.admin.dashboard({ view: 'trend', ...trendParams }),
    queryFn: () => api.get<BookingsTrend>('/api/admin/dashboard/bookings-trend', trendParams),
  });

  const topParams = { days: 30, limit: 5 };
  const top = useQuery({
    queryKey: queryKeys.admin.dashboard({ view: 'top', ...topParams }),
    queryFn: () => api.get<TopVehiclesData>('/api/admin/dashboard/top-vehicles', topParams),
  });

  const todayParams = useMemo(() => {
    const now = new Date();
    return {
      status: 'APPROVED,RESCHEDULED,COMPLETED',
      dateFrom: startOfDay(now).toISOString(),
      dateTo: endOfDay(now).toISOString(),
      sort: 'slotStartAsc',
      pageSize: 50,
    };
  }, []);
  const today = useQuery({
    queryKey: queryKeys.admin.bookings({ view: 'today', ...todayParams }),
    queryFn: () => api.get<Page<AdminBooking>>('/api/admin/bookings', todayParams),
    refetchInterval: REFRESH_MS,
  });

  if (summary.isError && !summary.data) {
    return (
      <ErrorState
        title="The dashboard could not be loaded"
        message="Please check your connection and try again."
        onRetry={() => void summary.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <KpiGrid kpis={summary.data ? buildKpis(summary.data) : null} />
      <div className="grid gap-8 xl:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-8">
          <NeedsAttention summary={summary.data ?? null} onAction={request} />
          <TrendChart
            trend={trend.data}
            failed={trend.isError}
            onRetry={() => void trend.refetch()}
          />
        </div>
        <div className="min-w-0 space-y-8">
          <TodaySchedule
            bookings={today.data?.items}
            failed={today.isError}
            onRetry={() => void today.refetch()}
          />
          <TopVehicles data={top.data} failed={top.isError} onRetry={() => void top.refetch()} />
        </div>
      </div>
      {dialogs}
    </div>
  );
}

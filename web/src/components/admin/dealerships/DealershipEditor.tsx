'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivationDialog } from '@/components/admin/ActivationDialog';
import { ActiveBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminDealership } from '@/types';
import { DealershipForm } from './DealershipForm';

export function DealershipEditor({ dealershipId }: { dealershipId: string }) {
  const [dialog, setDialog] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.admin.dealership(dealershipId),
    queryFn: () => api.get<AdminDealership>(`/api/admin/dealerships/${dealershipId}`),
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return missing ? (
      <EmptyState
        headingLevel={1}
        title="Showroom not found"
        description="It may have been removed, or the link may be incorrect."
        action={<ButtonLink href="/admin/dealerships">Back to showrooms</ButtonLink>}
      />
    ) : (
      <ErrorState headingLevel={1} onRetry={() => void query.refetch()} />
    );
  }

  const dealership = query.data;
  const mode = dealership.isActive ? 'deactivate' : 'activate';
  const upcoming = dealership.upcomingActiveBookingCount ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Showroom</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            {dealership.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <ActiveBadge active={dealership.isActive} />
            <span className="text-sm text-ink-600">
              {dealership.vehicleCount} vehicle{dealership.vehicleCount === 1 ? '' : 's'} ·{' '}
              {upcoming} upcoming active booking
              {upcoming === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <Button
          variant={dealership.isActive ? 'outline' : 'primary'}
          onClick={() => setDialog(true)}
        >
          {dealership.isActive ? 'Deactivate showroom' : 'Reactivate showroom'}
        </Button>
      </header>

      <DealershipForm key={dealership.updatedAt} dealership={dealership} />

      <ActivationDialog
        open={dialog}
        onClose={() => setDialog(false)}
        entity="showroom"
        name={dealership.name}
        mode={mode}
        bookingsHref={`/admin/bookings?dealershipId=${dealership.id}&status=PENDING,APPROVED,RESCHEDULED&sort=slotStartAsc`}
        request={() => api.patch(`/api/admin/dealerships/${dealership.id}/${mode}`)}
      />
    </div>
  );
}

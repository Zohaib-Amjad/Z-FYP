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
import type { AdminVehicleDetail } from '@/types';
import { DealershipLinks } from './DealershipLinks';
import { ImageManager } from './ImageManager';
import { VehicleForm } from './VehicleForm';

export function VehicleEditor({ vehicleId }: { vehicleId: string }) {
  const [dialog, setDialog] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.admin.vehicle(vehicleId),
    queryFn: () => api.get<AdminVehicleDetail>(`/api/admin/vehicles/${vehicleId}`),
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return missing ? (
      <EmptyState
        headingLevel={1}
        title="Vehicle not found"
        description="It may have been removed, or the link may be incorrect."
        action={<ButtonLink href="/admin/vehicles">Back to vehicles</ButtonLink>}
      />
    ) : (
      <ErrorState headingLevel={1} onRetry={() => void query.refetch()} />
    );
  }

  const vehicle = query.data;
  const name = `${vehicle.manufacturer} ${vehicle.model}`;
  const mode = vehicle.isActive ? 'deactivate' : 'activate';

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Vehicle</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <ActiveBadge active={vehicle.isActive} />
            <span className="text-sm text-ink-600">
              {vehicle.upcomingActiveBookingCount} upcoming active booking
              {vehicle.upcomingActiveBookingCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <Button variant={vehicle.isActive ? 'outline' : 'primary'} onClick={() => setDialog(true)}>
          {vehicle.isActive ? 'Deactivate vehicle' : 'Reactivate vehicle'}
        </Button>
      </header>

      <VehicleForm key={vehicle.updatedAt} vehicle={vehicle} />
      <ImageManager vehicleId={vehicle.id} vehicleName={name} images={vehicle.images} />
      <DealershipLinks
        key={`${vehicle.updatedAt}-${vehicle.dealerships.length}`}
        vehicleId={vehicle.id}
        links={vehicle.dealerships}
      />

      <ActivationDialog
        open={dialog}
        onClose={() => setDialog(false)}
        entity="vehicle"
        name={name}
        mode={mode}
        bookingsHref={`/admin/bookings?vehicleId=${vehicle.id}&status=PENDING,APPROVED,RESCHEDULED&sort=slotStartAsc`}
        request={() => api.patch(`/api/admin/vehicles/${vehicle.id}/${mode}`)}
      />
    </div>
  );
}

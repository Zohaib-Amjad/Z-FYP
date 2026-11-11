import { Suspense } from 'react';
import { VehiclesList } from '@/components/admin/vehicles/VehiclesList';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = { title: 'Vehicles' };

export default function AdminVehiclesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Vehicles"
        description="Manage the collection, including vehicles hidden from customers."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <VehiclesList />
      </Suspense>
    </>
  );
}

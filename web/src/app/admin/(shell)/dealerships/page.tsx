import { Suspense } from 'react';
import { DealershipsList } from '@/components/admin/dealerships/DealershipsList';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = { title: 'Showrooms' };

export default function AdminDealershipsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Showrooms"
        description="Manage dealership locations, including those hidden from customers."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DealershipsList />
      </Suspense>
    </>
  );
}

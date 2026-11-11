import { Suspense } from 'react';
import { SlotsView } from '@/components/admin/slots/SlotsView';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = { title: 'Time slots' };

export default function AdminSlotsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Time slots"
        description="Create and manage the appointment times customers can book."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SlotsView />
      </Suspense>
    </>
  );
}

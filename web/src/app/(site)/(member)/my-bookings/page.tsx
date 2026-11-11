import { Suspense } from 'react';
import { MyBookingsView } from '@/components/bookings/MyBookingsView';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = { title: 'My bookings' };

export default function MyBookingsPage() {
  return (
    <main id="main-content" className="container-page py-12">
      <PageHeader
        eyebrow="My account"
        title="My bookings"
        description="Follow your test-drive requests and manage upcoming appointments."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <MyBookingsView />
      </Suspense>
    </main>
  );
}

import { Suspense } from 'react';
import { BookingsList } from '@/components/admin/bookings/BookingsList';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = { title: 'Bookings' };

export default function AdminBookingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Bookings"
        description="Review, approve and manage every test-drive request."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <BookingsList />
      </Suspense>
    </>
  );
}

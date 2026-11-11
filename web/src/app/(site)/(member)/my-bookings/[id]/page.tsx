import { BookingDetailView } from '@/components/bookings/BookingDetailView';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export const metadata = { title: 'Booking details' };

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  return (
    <main id="main-content" className="container-page py-10">
      <Breadcrumbs
        className="mb-6"
        items={[
          { label: 'Home', href: '/' },
          { label: 'My bookings', href: '/my-bookings' },
          { label: 'Booking details' },
        ]}
      />
      <BookingDetailView bookingId={params.id} />
    </main>
  );
}

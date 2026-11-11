import { AdminBookingDetailView } from '@/components/admin/bookings/AdminBookingDetailView';

export const metadata = { title: 'Booking details' };

export default function AdminBookingDetailPage({ params }: { params: { id: string } }) {
  return <AdminBookingDetailView bookingId={params.id} />;
}

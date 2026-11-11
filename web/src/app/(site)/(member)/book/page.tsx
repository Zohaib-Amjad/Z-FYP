import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export const metadata = { title: 'Confirm your test drive' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function BookPage({ searchParams }: { searchParams: { slotId?: string } }) {
  const slotId = searchParams.slotId;

  return (
    <main id="main-content" className="container-page py-10">
      <Breadcrumbs
        className="mb-6"
        items={[
          { label: 'Home', href: '/' },
          { label: 'Vehicles', href: '/vehicles' },
          { label: 'Book a test drive' },
        ]}
      />
      {slotId && UUID.test(slotId) ? (
        <BookingConfirmation slotId={slotId} />
      ) : (
        <EmptyState
          headingLevel={1}
          title="Choose a time first"
          description="Pick a vehicle, showroom, date and time to start your booking."
          action={<ButtonLink href="/vehicles">Browse vehicles</ButtonLink>}
        />
      )}
    </main>
  );
}

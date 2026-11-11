import { SlotForm } from '@/components/admin/slots/SlotForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = { title: 'Add time slot' };

export default function NewSlotPage() {
  return (
    <>
      <PageHeader
        eyebrow="Time slots"
        title="Add a time slot"
        description="Create a single appointment time for a vehicle at a showroom."
      />
      <SlotForm />
    </>
  );
}

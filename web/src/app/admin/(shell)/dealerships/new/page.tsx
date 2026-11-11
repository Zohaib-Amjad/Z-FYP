import { DealershipForm } from '@/components/admin/dealerships/DealershipForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = { title: 'Add showroom' };

export default function NewDealershipPage() {
  return (
    <>
      <PageHeader
        eyebrow="Showrooms"
        title="Add a showroom"
        description="New showrooms start active. Assign vehicles to them from each vehicle's page."
      />
      <DealershipForm />
    </>
  );
}

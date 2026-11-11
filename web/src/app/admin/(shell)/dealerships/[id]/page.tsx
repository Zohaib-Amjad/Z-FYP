import { DealershipEditor } from '@/components/admin/dealerships/DealershipEditor';

export const metadata = { title: 'Edit showroom' };

export default function EditDealershipPage({ params }: { params: { id: string } }) {
  return <DealershipEditor dealershipId={params.id} />;
}

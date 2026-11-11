import { CustomerDetailView } from '@/components/admin/customers/CustomerDetailView';

export const metadata = { title: 'Customer' };

export default function AdminCustomerPage({ params }: { params: { id: string } }) {
  return <CustomerDetailView customerId={params.id} />;
}

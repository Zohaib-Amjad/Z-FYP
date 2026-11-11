import { Suspense } from 'react';
import { CustomersList } from '@/components/admin/customers/CustomersList';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = { title: 'Customers' };

export default function AdminCustomersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Customers"
        description="Registered customers and their booking history."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CustomersList />
      </Suspense>
    </>
  );
}

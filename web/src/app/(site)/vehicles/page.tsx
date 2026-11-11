import { Suspense } from 'react';
import { CatalogBrowser } from '@/components/catalog/CatalogBrowser';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = {
  title: 'The collection',
  description:
    'Browse our collection of luxury vehicles and reserve a private test drive at a showroom near you.',
};

export default function VehiclesPage() {
  return (
    <main id="main-content" className="container-page py-12">
      <PageHeader
        eyebrow="The collection"
        title="Find your next drive"
        description="Search and filter every vehicle available for a private test drive."
        breadcrumbs={<Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Vehicles' }]} />}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CatalogBrowser />
      </Suspense>
    </main>
  );
}

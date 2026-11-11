import { Skeleton } from '@/components/ui/Skeleton';

export default function VehicleLoading() {
  return (
    <main className="container-page py-10" aria-busy="true">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="mt-6 h-12 w-80 max-w-full" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="aspect-[16/10] w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </main>
  );
}

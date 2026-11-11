import { Skeleton } from '@/components/ui/Skeleton';

export default function MemberLoading() {
  return (
    <main className="container-page py-12" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-64 max-w-full" />
      <Skeleton className="mt-8 h-64 w-full" />
    </main>
  );
}

import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-64 max-w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

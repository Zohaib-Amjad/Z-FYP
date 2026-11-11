import { Spinner } from '@/components/ui/Spinner';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-gold-600">
      <Spinner className="h-8 w-8" label="Loading the page" />
    </div>
  );
}

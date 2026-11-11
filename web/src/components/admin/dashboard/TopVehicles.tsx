import Image from 'next/image';
import Link from 'next/link';
import { Car } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { TopVehicles as TopVehiclesData } from '@/types';

interface TopVehiclesProps {
  data: TopVehiclesData | undefined;
  failed?: boolean;
  onRetry?: () => void;
}

export function TopVehicles({ data, failed = false, onRetry }: TopVehiclesProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-semibold">Most requested</h2>
        <p className="mt-1 text-sm text-ink-600">
          Vehicles by test-drive requests, last {data?.days ?? 30} days.
        </p>
      </CardHeader>
      <CardBody>
        {failed && !data ? (
          <ErrorState
            title="The list could not be loaded"
            onRetry={onRetry}
            className="border-0 py-8"
          />
        ) : !data ? (
          <div className="space-y-3">
            {[0, 1, 2].map(index => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-600">No requests in this period yet.</p>
        ) : (
          <ol className="space-y-3">
            {data.items.map((item, index) => (
              <li key={item.vehicle.id} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="w-5 text-center font-display text-xl font-semibold text-ivory-400"
                >
                  {index + 1}
                </span>
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-control bg-ink-900">
                  {item.vehicle.primaryImage ? (
                    <Image
                      src={item.vehicle.primaryImage.url}
                      alt=""
                      fill
                      sizes="80px"
                      unoptimized={item.vehicle.primaryImage.url.endsWith('.svg')}
                      className="object-cover"
                    />
                  ) : (
                    <Car className="m-auto h-5 w-5 text-ink-500" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/bookings?vehicleId=${item.vehicle.id}`}
                    className="-my-3 block truncate py-3 text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    {item.vehicle.name}
                  </Link>
                  {item.vehicle.isActive ? null : (
                    <span className="text-xs text-ink-500">Inactive</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-ink-900">
                  {item.requests}
                  <span className="sr-only"> requests</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

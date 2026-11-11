import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatTime } from '@/lib/format';
import type { AdminBooking } from '@/types';

interface TodayScheduleProps {
  bookings: AdminBooking[] | undefined;
  failed?: boolean;
  onRetry?: () => void;
}

export function TodaySchedule({ bookings, failed = false, onRetry }: TodayScheduleProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-semibold">Today&rsquo;s schedule</h2>
        <p className="mt-1 min-h-5 text-sm text-ink-600">
          {bookings ? formatDate(new Date()) : null}
        </p>
      </CardHeader>
      <CardBody>
        {failed && !bookings ? (
          <ErrorState
            title="The schedule could not be loaded"
            onRetry={onRetry}
            className="border-0 py-8"
          />
        ) : !bookings ? (
          <Skeleton className="h-32 w-full" />
        ) : bookings.length === 0 ? (
          <p className="flex items-center gap-2.5 py-6 text-sm text-ink-600">
            <CalendarDays className="h-5 w-5 text-ink-400" aria-hidden="true" />
            No test drives are scheduled for today.
          </p>
        ) : (
          <ol className="relative space-y-5 border-l border-ivory-300 pl-6">
            {bookings.map(booking => (
              <li key={booking.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-full border-2 border-gold-500 bg-white"
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-display text-xl font-semibold">
                    {formatTime(booking.slot.startAt)}
                    <span className="text-sm font-normal text-ink-500">
                      {' '}
                      to {formatTime(booking.slot.endAt)}
                    </span>
                  </p>
                  <StatusBadge status={booking.status} />
                </div>
                <Link
                  href={`/admin/bookings/${booking.id}`}
                  className="-my-3 inline-block py-3 text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {booking.vehicle.name}
                </Link>
                <p className="text-xs text-ink-600">
                  {booking.customer.name} · {booking.dealership.name}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

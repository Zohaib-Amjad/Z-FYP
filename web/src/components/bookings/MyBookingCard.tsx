import Image from 'next/image';
import Link from 'next/link';
import { Car, Clock, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDate, formatRelative, formatTime } from '@/lib/format';
import { statusExplanation } from '@/lib/myBookings';
import type { MyBooking } from '@/types';

const ACTIVE = ['PENDING', 'APPROVED', 'RESCHEDULED'];

interface MyBookingCardProps {
  booking: MyBooking;
  onCancel: (booking: MyBooking) => void;
}

export function MyBookingCard({ booking, onCancel }: MyBookingCardProps) {
  const image = booking.vehicle.primaryImage;
  const explanation = statusExplanation(booking);
  const isActive = ACTIVE.includes(booking.status);

  return (
    <Card className="overflow-hidden sm:flex">
      <div className="relative aspect-[16/9] bg-ink-900 sm:aspect-auto sm:w-56 sm:shrink-0">
        {image ? (
          <Image
            src={image.url}
            alt={image.altText ?? booking.vehicle.name}
            fill
            sizes="(min-width: 640px) 14rem, 100vw"
            unoptimized={image.url.endsWith('.svg')}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full min-h-[8rem] items-center justify-center text-ink-500">
            <Car className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-2xl font-semibold leading-tight">
              <Link
                href={`/my-bookings/${booking.id}`}
                className="rounded underline-offset-4 hover:underline"
              >
                {booking.vehicle.name}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-ink-600">{booking.dealership.name}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <ul className="space-y-1.5 text-sm text-ink-700">
          <li className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
            <span>
              {formatDate(booking.startAt)}, {formatTime(booking.startAt)} to{' '}
              {formatTime(booking.endAt)}
              {isActive ? (
                <span className="ml-2 text-ink-500">({formatRelative(booking.startAt)})</span>
              ) : null}
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
            {booking.dealership.address}, {booking.dealership.city}
          </li>
        </ul>

        {explanation ? (
          <p className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm text-ink-800">
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-600">
              {explanation.label}
            </span>
            {explanation.text}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-3">
          <ButtonLink href={`/my-bookings/${booking.id}`} variant="outline" size="sm">
            View details
          </ButtonLink>
          {booking.canCancel ? (
            <Button variant="ghost" size="sm" onClick={() => onCancel(booking)}>
              Cancel appointment
            </Button>
          ) : isActive && booking.cancelBlockedReason ? (
            <p className="text-xs text-ink-600">{booking.cancelBlockedReason}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight, CalendarPlus, Car, Clock, MapPin, Phone } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, ApiError } from '@/lib/api';
import { bookingReference } from '@/lib/booking';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { describeSlot, historyHeadline, statusExplanation } from '@/lib/myBookings';
import { queryKeys } from '@/lib/queryKeys';
import type { MyBookingDetail } from '@/types';
import { CancelBookingDialog } from './CancelBookingDialog';

const ACTIVE = ['PENDING', 'APPROVED', 'RESCHEDULED'];

function addToCalendar(booking: MyBookingDetail): void {
  const reference = bookingReference(booking.id);
  const ics = buildIcs({
    uid: `${booking.id}@prestige-testdrive`,
    start: new Date(booking.startAt),
    end: new Date(booking.endAt),
    summary: `Test drive: ${booking.vehicle.name}`,
    location: `${booking.dealership.name}, ${booking.dealership.address}, ${booking.dealership.city}`,
    description: `Prestige Test Drive booking ${reference}. Bring your driving licence.`,
  });
  downloadIcs(`test-drive-${reference}.ics`, ics);
}

export function BookingDetailView({ bookingId }: { bookingId: string }) {
  const [cancelling, setCancelling] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.bookings.detail(bookingId),
    queryFn: () => api.get<MyBookingDetail>(`/api/bookings/${bookingId}`),
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return missing ? (
      <EmptyState
        headingLevel={1}
        title="We could not find that booking"
        description="It may belong to a different account, or the link may be incorrect."
        action={<ButtonLink href="/my-bookings">Back to my bookings</ButtonLink>}
      />
    ) : (
      <ErrorState headingLevel={1} onRetry={() => void query.refetch()} />
    );
  }

  const booking = query.data;
  const image = booking.vehicle.primaryImage;
  const explanation = statusExplanation(booking);
  const isActive = ACTIVE.includes(booking.status);
  const history = [...booking.statusHistory].reverse();

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-start">
      <div className="space-y-8">
        <Card className="overflow-hidden">
          <div className="relative aspect-[16/8] bg-ink-900">
            {image ? (
              <Image
                src={image.url}
                alt={image.altText ?? booking.vehicle.name}
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                unoptimized={image.url.endsWith('.svg')}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-500">
                <Car className="h-12 w-12" aria-hidden="true" />
              </div>
            )}
          </div>
          <CardBody className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Reference {bookingReference(booking.id)}</p>
                <h1 className="mt-1 font-display text-3xl font-semibold">{booking.vehicle.name}</h1>
              </div>
              <StatusBadge status={booking.status} />
            </div>
            <ul className="space-y-2.5 text-sm text-ink-700">
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
                {formatDate(booking.startAt)}, {formatTime(booking.startAt)} to{' '}
                {formatTime(booking.endAt)}
              </li>
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-ink-900">{booking.dealership.name}</strong>
                  <br />
                  {booking.dealership.address}, {booking.dealership.city}
                  <br />
                  {booking.dealership.openingHours}
                </span>
              </li>
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
                {booking.dealership.phone}
              </li>
            </ul>
            {booking.customerNote ? (
              <p className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-ink-600">
                  Your note
                </span>
                {booking.customerNote}
              </p>
            ) : null}
            {explanation ? (
              <p className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-ink-600">
                  {explanation.label}
                </span>
                {explanation.text}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 border-t border-ivory-300 pt-5">
              {isActive ? (
                <Button variant="outline" onClick={() => addToCalendar(booking)}>
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add to calendar
                </Button>
              ) : null}
              {booking.canCancel ? (
                <Button variant="ghost" onClick={() => setCancelling(true)}>
                  Cancel appointment
                </Button>
              ) : isActive && booking.cancelBlockedReason ? (
                <p className="text-sm text-ink-600">{booking.cancelBlockedReason}</p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">History</h2>
        </CardHeader>
        <CardBody>
          <ol className="relative space-y-6 border-l border-ivory-300 pl-6">
            {history.map(entry => (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full border-2 border-gold-500 bg-white"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink-900">{historyHeadline(entry)}</p>
                  <StatusBadge status={entry.toStatus} />
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {formatDateTime(entry.createdAt)} · {entry.changedBy.label}
                </p>
                {entry.oldSlot && entry.newSlot ? (
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-700">
                    <span>{describeSlot(entry.oldSlot)}</span>
                    <ArrowRight className="h-4 w-4 text-gold-700" aria-label="moved to" />
                    <span className="font-medium text-ink-900">{describeSlot(entry.newSlot)}</span>
                  </p>
                ) : null}
                {entry.note ? <p className="mt-2 text-sm text-ink-700">{entry.note}</p> : null}
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <CancelBookingDialog
        booking={cancelling ? booking : null}
        onClose={() => setCancelling(false)}
      />
    </div>
  );
}

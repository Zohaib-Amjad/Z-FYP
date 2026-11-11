'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Car, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { ActionButtons } from '@/components/admin/ActionButtons';
import { useBookingActionDialogs } from '@/components/admin/BookingActionDialogs';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, ApiError } from '@/lib/api';
import { bookingReference } from '@/lib/booking';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { describeSlot, historyHeadline } from '@/lib/myBookings';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminBooking, AdminBookingDetail } from '@/types';

function Note({ label, text }: { label: string; text: string }) {
  return (
    <p className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wider text-ink-600">
        {label}
      </span>
      {text}
    </p>
  );
}

/** The action dialogs and buttons work on the list shape, which the detail record contains. */
const asListItem = (booking: AdminBookingDetail): AdminBooking => booking;

export function AdminBookingDetailView({ bookingId }: { bookingId: string }) {
  const { request, dialogs } = useBookingActionDialogs();
  const query = useQuery({
    queryKey: queryKeys.admin.booking(bookingId),
    queryFn: () => api.get<AdminBookingDetail>(`/api/admin/bookings/${bookingId}`),
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return missing ? (
      <EmptyState
        headingLevel={1}
        title="Booking not found"
        description="It may have been removed, or the link may be incorrect."
        action={<ButtonLink href="/admin/bookings">Back to bookings</ButtonLink>}
      />
    ) : (
      <ErrorState headingLevel={1} onRetry={() => void query.refetch()} />
    );
  }

  const booking = query.data;
  const image = booking.vehicle.primaryImage;
  const history = [...booking.statusHistory].reverse();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Booking {bookingReference(booking.id)}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
            {booking.customer.name}
          </h1>
          <p className="mt-1 text-ink-600">
            {booking.vehicle.name} · {formatDate(booking.slot.startAt)},{' '}
            {formatTime(booking.slot.startAt)}
          </p>
        </div>
        <StatusBadge status={booking.status} className="text-sm" />
      </header>

      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-600">
            Actions
          </h2>
          <ActionButtons
            booking={booking}
            showDisabled
            size="md"
            onAction={action => request(asListItem(booking), action)}
          />
        </CardBody>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <h2 className="font-display text-2xl font-semibold">Customer</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <p className="text-base font-semibold text-ink-900">
                {booking.customer.name}
                {booking.customer.isActive ? null : (
                  <span className="ml-2 text-xs font-normal text-status-rejected">
                    Account deactivated
                  </span>
                )}
              </p>
              <p className="flex items-center gap-2.5 text-ink-700">
                <Mail className="h-4 w-4 text-gold-700" aria-hidden="true" />
                <a
                  href={`mailto:${booking.customer.email}`}
                  className="-my-3 inline-block py-3 underline-offset-4 hover:underline"
                >
                  {booking.customer.email}
                </a>
              </p>
              {booking.customer.phone ? (
                <p className="flex items-center gap-2.5 text-ink-700">
                  <Phone className="h-4 w-4 text-gold-700" aria-hidden="true" />
                  {booking.customer.phone}
                </p>
              ) : null}
              <p className="text-ink-700">
                Driving licence:{' '}
                <strong className="font-semibold text-ink-900">
                  {booking.customer.drivingLicenseNumber ?? 'Not provided'}
                </strong>
              </p>
              <Link
                href={`/admin/customers/${booking.customer.id}`}
                className="-my-3 inline-block py-3 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline"
              >
                View customer
              </Link>
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <div className="relative aspect-[16/8] bg-ink-900">
              {image ? (
                <Image
                  src={image.url}
                  alt={image.altText ?? booking.vehicle.name}
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  unoptimized={image.url.endsWith('.svg')}
                  className="object-cover"
                />
              ) : (
                <Car className="m-auto h-10 w-10 text-ink-500" aria-hidden="true" />
              )}
            </div>
            <CardBody className="space-y-3 text-sm">
              <h2 className="font-display text-2xl font-semibold">{booking.vehicle.name}</h2>
              <p className="text-ink-600">
                {booking.vehicle.year}
                {booking.vehicle.color ? ` · ${booking.vehicle.color}` : ''}
              </p>
              <ul className="space-y-2.5 text-ink-700">
                <li className="flex gap-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
                  {formatDateTime(booking.slot.startAt)} to {formatTime(booking.slot.endAt)}
                </li>
                <li className="flex gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold text-ink-900">
                      {booking.dealership.name}
                    </strong>
                    <br />
                    {booking.dealership.address}, {booking.dealership.city}
                    <br />
                    {booking.dealership.phone}
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-8">
          {booking.customerNote ||
          booking.staffNote ||
          booking.rejectionReason ||
          booking.cancellationReason ? (
            <Card>
              <CardHeader>
                <h2 className="font-display text-2xl font-semibold">Notes</h2>
              </CardHeader>
              <CardBody className="space-y-3">
                {booking.customerNote ? (
                  <Note label="Customer note" text={booking.customerNote} />
                ) : null}
                {booking.staffNote ? <Note label="Staff note" text={booking.staffNote} /> : null}
                {booking.rejectionReason ? (
                  <Note label="Rejection reason" text={booking.rejectionReason} />
                ) : null}
                {booking.cancellationReason ? (
                  <Note
                    label={`Cancellation reason (${booking.cancelledBy === 'STAFF' ? 'staff' : 'customer'})`}
                    text={booking.cancellationReason}
                  />
                ) : null}
              </CardBody>
            </Card>
          ) : null}

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
                      {formatDateTime(entry.createdAt)} ·{' '}
                      {entry.changedBy
                        ? `${entry.changedBy.name} (${entry.changedBy.role === 'STAFF' ? 'staff' : 'customer'})`
                        : 'System'}
                    </p>
                    {entry.oldSlot && entry.newSlot ? (
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-700">
                        <span>{describeSlot(entry.oldSlot)}</span>
                        <ArrowRight className="h-4 w-4 text-gold-700" aria-label="moved to" />
                        <span className="font-medium text-ink-900">
                          {describeSlot(entry.newSlot)}
                        </span>
                      </p>
                    ) : null}
                    {entry.note ? <p className="mt-2 text-sm text-ink-700">{entry.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
      {dialogs}
    </div>
  );
}

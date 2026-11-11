'use client';

import { CalendarPlus, CheckCircle2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { bookingReference } from '@/lib/booking';
import { formatDateTime } from '@/lib/format';
import { buildIcs, downloadIcs } from '@/lib/ics';
import type { Booking } from '@/types';

const NEXT_STEPS = [
  'Our showroom team reviews your request, usually within one working day.',
  'You will receive a notification, and an email, as soon as it is approved or if we need to suggest another time.',
  'Bring your driving licence to the showroom on the day of your appointment.',
] as const;

export function BookingSuccess({ booking }: { booking: Booking }) {
  const reference = bookingReference(booking.id);
  const vehicle = `${booking.vehicle.manufacturer} ${booking.vehicle.model}`;

  const addToCalendar = () => {
    const ics = buildIcs({
      uid: `${booking.id}@prestige-testdrive`,
      start: new Date(booking.slot.startAt),
      end: new Date(booking.slot.endAt),
      summary: `Test drive: ${vehicle}`,
      location: `${booking.dealership.name}, ${booking.dealership.address}, ${booking.dealership.city}`,
      description: `Prestige Test Drive booking ${reference}. Your request is pending approval; you will be notified when it is confirmed.`,
    });
    downloadIcs(`test-drive-${reference}.ics`, ics);
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <CardBody className="space-y-7 p-6 sm:p-10">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e3f4ea] text-status-approved">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-5">Request received</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Your test drive is requested</h1>
          <p className="mt-2 text-ink-600">
            Thank you. We have your request and will be in touch shortly.
          </p>
        </div>

        <dl className="divide-y divide-ivory-300 rounded-card border border-ivory-300 text-sm">
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-ink-600">Booking reference</dt>
            <dd className="font-semibold tracking-wider text-ink-900">{reference}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="text-ink-600">Status</dt>
            <dd className="flex items-center gap-2 font-medium">
              <StatusBadge status={booking.status} />
              <span className="text-ink-700">Pending approval</span>
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-ink-600">Vehicle</dt>
            <dd className="text-right font-medium text-ink-900">{vehicle}</dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-ink-600">When</dt>
            <dd className="text-right font-medium text-ink-900">
              {formatDateTime(booking.slot.startAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-ink-600">Where</dt>
            <dd className="text-right font-medium text-ink-900">
              {booking.dealership.name}
              <span className="block text-xs font-normal text-ink-600">
                {booking.dealership.address}, {booking.dealership.city}
              </span>
            </dd>
          </div>
        </dl>

        <section aria-labelledby="next-heading">
          <h2 id="next-heading" className="font-display text-2xl font-semibold">
            What happens next
          </h2>
          <ol className="mt-3 space-y-3">
            {NEXT_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-ink-700">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-gold-300"
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/my-bookings" className="flex-1">
            View my bookings
          </ButtonLink>
          <Button variant="outline" className="flex-1" onClick={addToCalendar}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Add to calendar
          </Button>
          <ButtonLink href="/vehicles" variant="ghost" className="flex-1">
            Keep browsing
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}

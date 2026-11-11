'use client';

import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { SlotPicker } from '@/components/booking/SlotPicker';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { formatDateTime } from '@/lib/format';
import type { AvailableSlot, VehicleDealership } from '@/types';

interface BookingPanelProps {
  vehicleId: string;
  dealerships: VehicleDealership[];
}

export function BookingPanel({ vehicleId, dealerships }: BookingPanelProps) {
  const { user } = useAuth();
  const bookable = dealerships.filter(dealership => dealership.upcomingAvailableSlots > 0);
  const [dealershipId, setDealershipId] = useState(bookable.length === 1 ? bookable[0].id : '');
  const [slot, setSlot] = useState<AvailableSlot | null>(null);

  const bookingPath = slot ? `/book?slotId=${slot.id}` : null;
  const href = bookingPath
    ? user
      ? bookingPath
      : `/login?next=${encodeURIComponent(bookingPath)}`
    : null;
  const isStaff = user?.role === 'STAFF';

  return (
    <Card className="lg:sticky lg:top-24">
      <CardBody className="space-y-5 p-6">
        <div>
          <p className="eyebrow">Private test drive</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Book a test drive</h2>
        </div>

        {bookable.length === 0 ? (
          <p className="rounded-control bg-ivory-200 px-4 py-3 text-sm text-ink-700">
            This vehicle has no open appointments at the moment. Please check back soon or contact
            one of our showrooms.
          </p>
        ) : (
          <>
            <FormField label="1. Choose a showroom">
              {control => (
                <Select
                  {...control}
                  value={dealershipId}
                  onChange={event => {
                    setDealershipId(event.target.value);
                    setSlot(null);
                  }}
                >
                  <option value="">Select a showroom</option>
                  {bookable.map(dealership => (
                    <option key={dealership.id} value={dealership.id}>
                      {dealership.name}, {dealership.city}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            {dealershipId ? (
              <div>
                <p className="mb-2 text-sm font-medium text-ink-800">2. Choose a date and time</p>
                <SlotPicker
                  key={dealershipId}
                  vehicleId={vehicleId}
                  dealershipId={dealershipId}
                  selectedSlotId={slot?.id ?? null}
                  onSelect={setSlot}
                />
              </div>
            ) : null}

            {slot ? (
              <p
                role="status"
                className="flex items-start gap-2.5 rounded-control bg-ivory-200 px-4 py-3 text-sm text-ink-800"
              >
                <CalendarCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-gold-700"
                  aria-hidden="true"
                />
                {formatDateTime(slot.startAt)} at {slot.dealership.name}
              </p>
            ) : null}

            {isStaff ? (
              <p
                role="note"
                className="rounded-control bg-ivory-200 px-4 py-3 text-sm text-ink-700"
              >
                Booking is available to customer accounts only. Staff manage appointments from the
                administration portal.
              </p>
            ) : href ? (
              <ButtonLink href={href} size="lg" className="w-full">
                {user ? 'Continue to confirmation' : 'Sign in to continue'}
              </ButtonLink>
            ) : (
              <Button size="lg" className="w-full" disabled>
                Select a time to continue
              </Button>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

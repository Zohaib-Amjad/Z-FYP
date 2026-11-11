'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { SlotPicker } from '@/components/booking/SlotPicker';
import { useBookingAction } from '@/hooks/useBookingAction';
import { MAX_NOTE_LENGTH, validateActionText } from '@/lib/adminBookings';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminBooking, AvailableSlot, BookingAction, VehicleDetail } from '@/types';

interface DialogCopy {
  title: string;
  confirm: string;
  variant: 'primary' | 'danger';
  label?: string;
  hint?: string;
  required: boolean;
}

const COPY: Record<Exclude<BookingAction, 'reschedule'>, DialogCopy> = {
  approve: {
    title: 'Approve this test drive?',
    confirm: 'Approve booking',
    variant: 'primary',
    label: 'Note for the customer (optional)',
    hint: 'Shown to the customer with their confirmation.',
    required: false,
  },
  reject: {
    title: 'Reject this request?',
    confirm: 'Reject request',
    variant: 'danger',
    label: 'Reason for the customer',
    hint: 'Required. Explain why the request cannot be accommodated; the customer will see this.',
    required: true,
  },
  cancel: {
    title: 'Cancel this appointment?',
    confirm: 'Cancel appointment',
    variant: 'danger',
    label: 'Reason for the customer',
    hint: 'Required. The customer will be notified and will see this reason.',
    required: true,
  },
  complete: {
    title: 'Mark this test drive as completed?',
    confirm: 'Mark completed',
    variant: 'primary',
    label: 'Internal note (optional)',
    hint: 'For example, how the drive went or any follow-up.',
    required: false,
  },
};

function Summary({ booking }: { booking: AdminBooking }) {
  return (
    <p className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm text-ink-800">
      <strong className="font-semibold">{booking.customer.name}</strong> · {booking.vehicle.name}
      <br />
      {formatDateTime(booking.slot.startAt)} at {booking.dealership.name}
    </p>
  );
}

function TextActionDialog({
  booking,
  action,
  onClose,
}: {
  booking: AdminBooking;
  action: Exclude<BookingAction, 'reschedule'>;
  onClose: () => void;
}) {
  const copy = COPY[action];
  const run = useBookingAction();
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const error = touched ? validateActionText(action, text) : null;

  const submit = () => {
    setTouched(true);
    if (validateActionText(action, text)) return;
    run.mutate({ bookingId: booking.id, action, input: { text } });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Go back
          </Button>
          <Button variant={copy.variant} onClick={submit}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Summary booking={booking} />
        <FormField
          label={copy.label ?? ''}
          hint={`${text.length} of ${MAX_NOTE_LENGTH} characters. ${copy.hint ?? ''}`}
          error={error ?? undefined}
          required={copy.required}
        >
          {control => (
            <Textarea
              {...control}
              rows={3}
              value={text}
              onChange={event => setText(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}

function RescheduleDialog({ booking, onClose }: { booking: AdminBooking; onClose: () => void }) {
  const run = useBookingAction();
  const [dealershipId, setDealershipId] = useState('');
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [note, setNote] = useState('');

  const vehicle = useQuery({
    queryKey: queryKeys.vehicles.detail(booking.vehicle.id),
    queryFn: () => api.get<VehicleDetail>(`/api/vehicles/${booking.vehicle.id}`),
  });
  const noteError = note.length > MAX_NOTE_LENGTH ? `At most ${MAX_NOTE_LENGTH} characters.` : null;

  const submit = () => {
    if (!slot || noteError) return;
    run.mutate({
      bookingId: booking.id,
      action: 'reschedule',
      input: { newSlotId: slot.id, text: note },
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule this test drive"
      description="Choose another time for the same vehicle. The customer is notified of the change."
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Go back
          </Button>
          <Button onClick={submit} disabled={!slot || noteError !== null}>
            Move to this time
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <Summary booking={booking} />
        <FormField label="Showroom">
          {control => (
            <Select
              {...control}
              value={dealershipId}
              onChange={event => {
                setDealershipId(event.target.value);
                setSlot(null);
              }}
            >
              <option value="">All showrooms offering this vehicle</option>
              {(vehicle.data?.dealerships ?? []).map(dealership => (
                <option key={dealership.id} value={dealership.id}>
                  {dealership.name}, {dealership.city}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <SlotPicker
          key={dealershipId}
          vehicleId={booking.vehicle.id}
          dealershipId={dealershipId}
          selectedSlotId={slot?.id ?? null}
          onSelect={setSlot}
          showDealership
        />
        {slot ? (
          <p role="status" className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm">
            New time: <strong>{formatDateTime(slot.startAt)}</strong> at {slot.dealership.name}
          </p>
        ) : null}
        <FormField
          label="Note for the customer (optional)"
          hint={`${note.length} of ${MAX_NOTE_LENGTH} characters.`}
          error={noteError ?? undefined}
        >
          {control => (
            <Textarea
              {...control}
              rows={2}
              value={note}
              onChange={event => setNote(event.target.value)}
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}

interface PendingAction {
  booking: AdminBooking;
  action: BookingAction;
}

/**
 * Dialogs for the five staff actions. Call `request(booking, action)` from a button and render
 * `dialogs` once in the page.
 */
export function useBookingActionDialogs(): {
  request: (booking: AdminBooking, action: BookingAction) => void;
  dialogs: ReactNode;
} {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const close = () => setPending(null);

  let dialogs: ReactNode = null;
  if (pending?.action === 'reschedule') {
    dialogs = (
      <RescheduleDialog key={pending.booking.id} booking={pending.booking} onClose={close} />
    );
  } else if (pending) {
    dialogs = (
      <TextActionDialog
        key={`${pending.booking.id}-${pending.action}`}
        booking={pending.booking}
        action={pending.action}
        onClose={close}
      />
    );
  }

  return { request: (booking, action) => setPending({ booking, action }), dialogs };
}

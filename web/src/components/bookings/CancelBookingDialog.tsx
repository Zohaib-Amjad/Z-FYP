'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { useCancelBooking } from '@/hooks/useCancelBooking';
import { formatDateTime } from '@/lib/format';
import { MAX_NOTE_LENGTH } from '@/lib/schemas';
import type { MyBooking } from '@/types';

interface CancelBookingDialogProps {
  booking: MyBooking | null;
  onClose: () => void;
}

export function CancelBookingDialog({ booking, onClose }: CancelBookingDialogProps) {
  const cancel = useCancelBooking();
  const [reason, setReason] = useState('');
  const tooLong = reason.length > MAX_NOTE_LENGTH;

  const close = () => {
    setReason('');
    onClose();
  };

  const confirm = () => {
    if (!booking || tooLong) return;
    cancel.mutate({ booking, reason: reason.trim() || null });
    close();
  };

  return (
    <ConfirmDialog
      open={booking !== null}
      onClose={close}
      onConfirm={confirm}
      title="Cancel this test drive?"
      description={
        booking
          ? `${booking.vehicle.name} at ${booking.dealership.name} on ${formatDateTime(booking.startAt)}. The time will be released for other customers.`
          : ''
      }
      confirmLabel="Cancel appointment"
      cancelLabel="Keep appointment"
      confirmVariant="danger"
    >
      <FormField
        label="Reason (optional)"
        hint="Sharing why helps the showroom, but is not required."
        error={tooLong ? `The reason can be at most ${MAX_NOTE_LENGTH} characters` : undefined}
      >
        {control => (
          <Textarea
            {...control}
            rows={3}
            value={reason}
            onChange={event => setReason(event.target.value)}
          />
        )}
      </FormField>
    </ConfirmDialog>
  );
}

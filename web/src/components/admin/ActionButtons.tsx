'use client';

import { useId } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { bookingActions } from '@/lib/adminBookings';
import type { AdminBooking, BookingAction } from '@/types';

const VARIANTS: Record<BookingAction, ButtonVariant> = {
  approve: 'primary',
  reject: 'outline',
  reschedule: 'outline',
  cancel: 'outline',
  complete: 'secondary',
};

interface ActionButtonsProps {
  booking: Pick<AdminBooking, 'id' | 'status' | 'slot'>;
  onAction: (action: BookingAction) => void;
  /** Also show the unavailable actions, disabled, with the reason as a tooltip. */
  showDisabled?: boolean;
  size?: 'sm' | 'md';
  /** Offer only these actions (quick actions on dashboard panels). */
  only?: BookingAction[];
}

/** Staff action buttons for a booking, derived from the state machine (A2). */
export function ActionButtons({
  booking,
  onAction,
  showDisabled = false,
  size = 'sm',
  only,
}: ActionButtonsProps) {
  const base = useId();
  const states = bookingActions(booking.status, booking.slot.startAt).filter(
    state => !only || only.includes(state.action),
  );
  const visible = showDisabled ? states : states.filter(state => state.allowed);

  if (visible.length === 0) {
    return <span className="text-xs text-ink-500">No further actions</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(state => {
        const reasonId = `${base}-${state.action}`;
        return (
          <span
            key={state.action}
            title={state.allowed ? undefined : state.reason}
            className="inline-flex"
          >
            <Button
              variant={VARIANTS[state.action]}
              size={size}
              disabled={!state.allowed}
              aria-describedby={state.allowed ? undefined : reasonId}
              onClick={() => onAction(state.action)}
            >
              {state.label}
            </Button>
            {state.allowed ? null : (
              <span id={reasonId} className="sr-only">
                {state.reason}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button, ButtonLink, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface Blocked {
  message: string;
  count: string | null;
}

interface ActivationDialogProps {
  open: boolean;
  onClose: () => void;
  /** Singular noun, e.g. "vehicle". */
  entity: string;
  /** Name shown in the heading, e.g. "Aston Martin Vantage". */
  name: string;
  mode: 'activate' | 'deactivate';
  /** Extra consequence shown before confirming (deactivate only). */
  warning?: string;
  /** Overrides the default explanation under the title. */
  descriptions?: { deactivate: string; activate: string };
  /** Where staff can review the bookings that block a deactivation. */
  bookingsHref?: string;
  /** Performs the change. Throw an ApiError to report failure. */
  request: () => Promise<unknown>;
  successMessage?: (result: unknown) => string;
}

const BLOCKING_CODES: ApiError['code'][] = ['HAS_ACTIVE_BOOKINGS', 'CONFLICT'];

/**
 * Confirm dialog for activating or deactivating a record (A6: deactivation is a soft delete).
 * When the server refuses because of active bookings, the dialog explains why, shows the count
 * and links to the bookings that must be cancelled or rescheduled first.
 */
export function ActivationDialog({
  open,
  onClose,
  entity,
  name,
  mode,
  warning,
  descriptions,
  bookingsHref,
  request,
  successMessage,
}: ActivationDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const deactivating = mode === 'deactivate';

  const close = () => {
    setBlocked(null);
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await request();
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      toast.success(
        successMessage?.(result) ??
          `${name} has been ${deactivating ? 'deactivated' : 'reactivated'}.`,
      );
      close();
    } catch (error) {
      if (error instanceof ApiError && BLOCKING_CODES.includes(error.code)) {
        setBlocked({
          message: error.message,
          count: error.details.find(d => d.field === 'activeBookingCount')?.message ?? null,
        });
      } else {
        toast.error(
          error instanceof ApiError
            ? error.message
            : 'We could not complete that. Please try again.',
        );
        close();
      }
    } finally {
      setBusy(false);
    }
  };

  const variant: ButtonVariant = deactivating ? 'danger' : 'primary';

  if (blocked) {
    return (
      <Modal
        open={open}
        onClose={close}
        title={`This ${entity} cannot be deactivated yet`}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Close
            </Button>
            {bookingsHref ? <ButtonLink href={bookingsHref}>View those bookings</ButtonLink> : null}
          </>
        }
      >
        <div className="flex gap-3">
          <ShieldAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-status-rejected"
            aria-hidden="true"
          />
          <div className="space-y-2 text-sm text-ink-700">
            <p>{blocked.message}</p>
            {blocked.count ? (
              <p>
                <strong className="font-semibold text-ink-900">{blocked.count}</strong> upcoming
                booking
                {blocked.count === '1' ? '' : 's'} must be cancelled or rescheduled first.
              </p>
            ) : null}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={deactivating ? `Deactivate ${name}?` : `Reactivate ${name}?`}
      description={
        deactivating
          ? (descriptions?.deactivate ??
            `The ${entity} will be hidden from customers but kept in your records and history.`)
          : (descriptions?.activate ?? `The ${entity} will be visible to customers again.`)
      }
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Go back
          </Button>
          <Button variant={variant} onClick={() => void confirm()} loading={busy}>
            {deactivating ? 'Deactivate' : 'Reactivate'}
          </Button>
        </>
      }
    >
      {deactivating && warning ? (
        <p className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm text-ink-800">{warning}</p>
      ) : null}
    </Modal>
  );
}

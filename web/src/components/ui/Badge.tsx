import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import type { BookingStatus } from '@/types';

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: 'bg-status-pending-soft text-status-pending ring-status-pending-line',
  APPROVED: 'bg-status-approved-soft text-status-approved ring-status-approved-line',
  REJECTED: 'bg-status-rejected-soft text-status-rejected ring-status-rejected-line',
  CANCELLED: 'bg-status-cancelled-soft text-status-cancelled ring-status-cancelled-line',
  COMPLETED: 'bg-status-completed-soft text-status-completed ring-status-completed-line',
  RESCHEDULED: 'bg-status-rescheduled-soft text-status-rescheduled ring-status-rescheduled-line',
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  RESCHEDULED: 'Rescheduled',
};

const BASE =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset';

export function Badge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(BASE, 'bg-ink-100 text-ink-700 ring-ink-300', className)} {...rest} />;
}

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn(BASE, STATUS_STYLES[status], className)}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Active or inactive record marker; always carries text, never colour alone. */
export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      className={cn(
        BASE,
        active
          ? 'bg-status-approved-soft text-status-approved ring-status-approved-line'
          : 'bg-ink-100 text-ink-600 ring-ink-300',
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

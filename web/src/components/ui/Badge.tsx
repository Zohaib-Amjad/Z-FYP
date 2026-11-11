import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import type { BookingStatus } from '@/types';

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: 'bg-[#fbf1d9] text-status-pending ring-[#e8cf94]',
  APPROVED: 'bg-[#e3f4ea] text-status-approved ring-[#a8d6bb]',
  REJECTED: 'bg-[#fbe8ea] text-status-rejected ring-[#e9b0b7]',
  CANCELLED: 'bg-ink-100 text-status-cancelled ring-ink-300',
  COMPLETED: 'bg-[#e4ecf8] text-status-completed ring-[#b2c6e6]',
  RESCHEDULED: 'bg-[#efe6f8] text-status-rescheduled ring-[#cdb5e6]',
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
          ? 'bg-[#e3f4ea] text-status-approved ring-[#a8d6bb]'
          : 'bg-ink-100 text-ink-600 ring-ink-300',
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

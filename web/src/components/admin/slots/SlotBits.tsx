import { cn } from '@/lib/cn';
import { SLOT_STATE_LABELS, slotState } from '@/lib/adminSlots';
import { StatusBadge } from '@/components/ui/Badge';
import type { AdminSlot } from '@/types';

const STATE_STYLES = {
  free: 'bg-[#e3f4ea] text-status-approved ring-[#a8d6bb]',
  booked: 'bg-[#e4ecf8] text-status-completed ring-[#b2c6e6]',
  inactive: 'bg-ink-100 text-ink-600 ring-ink-300',
} as const;

/** Free, booked or inactive marker for a slot; always has text. */
export function SlotStateBadge({ slot }: { slot: Pick<AdminSlot, 'isActive' | 'activeBooking'> }) {
  const state = slotState(slot);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STATE_STYLES[state],
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {SLOT_STATE_LABELS[state]}
    </span>
  );
}

/** Who holds a booked slot, with the booking's status. */
export function SlotBooking({ slot }: { slot: AdminSlot }) {
  if (!slot.activeBooking) return <span className="text-ink-500">Not booked</span>;
  const { customer, status } = slot.activeBooking;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>
        {customer.firstName} {customer.lastName}
      </span>
      <StatusBadge status={status} />
    </span>
  );
}

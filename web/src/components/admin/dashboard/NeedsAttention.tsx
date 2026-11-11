import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ActionButtons } from '@/components/admin/ActionButtons';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { AdminBooking, BookingAction, DashboardSummary } from '@/types';

interface GroupProps {
  title: string;
  hint: string;
  count: number;
  items: AdminBooking[];
  only: BookingAction[];
  moreHref: string;
  onAction: (booking: AdminBooking, action: BookingAction) => void;
  whenLabel: (booking: AdminBooking) => string;
}

function Group({ title, hint, count, items, only, moreHref, onAction, whenLabel }: GroupProps) {
  if (count === 0) return null;
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-semibold">
          {title} <span className="text-gold-700">({count})</span>
        </h3>
        {count > items.length ? (
          <Link
            href={moreHref}
            className="text-xs font-semibold text-gold-700 underline-offset-4 hover:underline"
          >
            View all {count}
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-ink-500">{hint}</p>
      <ul className="mt-3 divide-y divide-ivory-300 rounded-card border border-ivory-300">
        {items.map(booking => (
          <li
            key={booking.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="-my-3 inline-block py-3 text-sm font-semibold text-ink-900 underline-offset-4 hover:underline"
              >
                {booking.customer.name}
              </Link>
              <p className="truncate text-xs text-ink-600">
                {booking.vehicle.name} · {booking.dealership.name}
              </p>
              <p className="text-xs text-ink-500">{whenLabel(booking)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={booking.status} />
              <ActionButtons
                booking={booking}
                only={only}
                onAction={action => onAction(booking, action)}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface NeedsAttentionProps {
  summary: DashboardSummary | null;
  onAction: (booking: AdminBooking, action: BookingAction) => void;
}

export function NeedsAttention({ summary, onAction }: NeedsAttentionProps) {
  const overdue = summary?.needsAttention.pendingOlderThan24h;
  const past = summary?.needsAttention.pastNotCompleted;
  const nothing = summary && overdue?.count === 0 && past?.count === 0;

  return (
    <Card>
      <CardHeader className="flex items-center gap-2.5">
        <AlertTriangle className="h-5 w-5 text-gold-700" aria-hidden="true" />
        <h2 className="font-display text-2xl font-semibold">Needs attention</h2>
      </CardHeader>
      <CardBody className="space-y-7">
        {nothing ? (
          <p className="flex items-center gap-2.5 text-sm text-ink-700">
            <CheckCircle2 className="h-5 w-5 text-status-approved" aria-hidden="true" />
            Everything is up to date. There are no overdue requests or unfinished drives.
          </p>
        ) : null}
        {overdue ? (
          <Group
            title="Requests waiting over 24 hours"
            hint="Customers are still waiting for an answer."
            count={overdue.count}
            items={overdue.items}
            only={['approve', 'reject']}
            moreHref="/admin/bookings?status=PENDING&sort=slotStartAsc"
            onAction={onAction}
            whenLabel={booking =>
              `Requested ${formatRelative(booking.createdAt)}, drive on ${formatDateTime(booking.slot.startAt)}`
            }
          />
        ) : null}
        {past ? (
          <Group
            title="Drives that have taken place"
            hint="Approved appointments whose time has passed; mark them completed."
            count={past.count}
            items={past.items}
            only={['complete']}
            moreHref="/admin/bookings?status=APPROVED,RESCHEDULED&sort=slotStartAsc"
            onAction={onAction}
            whenLabel={booking => `Took place ${formatDateTime(booking.slot.startAt)}`}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}

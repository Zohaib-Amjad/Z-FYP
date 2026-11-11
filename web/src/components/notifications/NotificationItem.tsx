import {
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import type { Notification, NotificationType } from '@/types';

const ICONS: Record<NotificationType, LucideIcon> = {
  BOOKING_CREATED: Sparkles,
  BOOKING_APPROVED: CalendarCheck,
  BOOKING_REJECTED: CalendarX2,
  BOOKING_RESCHEDULED: CalendarClock,
  BOOKING_CANCELLED: CalendarX2,
  BOOKING_COMPLETED: CheckCircle2,
};

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  compact?: boolean;
}

export function NotificationItem({ notification, onOpen, compact = false }: NotificationItemProps) {
  const Icon = ICONS[notification.type];
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex w-full items-start gap-3 px-4 text-left transition-colors hover:bg-ivory-200 focus-visible:bg-ivory-200',
        compact ? 'py-3' : 'py-4',
        notification.isRead ? 'bg-transparent' : 'bg-gold-200/30',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          notification.isRead ? 'bg-ink-100 text-ink-500' : 'bg-ink-900 text-gold-300',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'text-sm text-ink-900',
              notification.isRead ? 'font-medium' : 'font-semibold',
            )}
          >
            {notification.title}
            {notification.isRead ? null : <span className="sr-only"> (unread)</span>}
          </span>
          {notification.isRead ? null : (
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" />
          )}
        </span>
        <span className={cn('mt-0.5 block text-sm text-ink-600', compact && 'line-clamp-2')}>
          {notification.message}
        </span>
        <span className="mt-1 block text-xs text-ink-500">
          {formatRelative(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}

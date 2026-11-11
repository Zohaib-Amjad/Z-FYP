'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotificationActions } from '@/hooks/useNotificationActions';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Notification, Page } from '@/types';
import { NotificationItem } from './NotificationItem';

const LATEST = 5;

/** Bell with an unread badge and a dropdown of the latest notifications. */
export function NotificationBell() {
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const { open: openNotification, markAllRead } = useNotificationActions();

  const params = { page: 1, pageSize: LATEST };
  const latest = useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => api.get<Page<Notification>>('/api/notifications', params),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(current => !current)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-ivory-200 hover:bg-ivory-100/10 hover:text-white"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-gold-400 px-1 text-[0.65rem] font-bold text-ink-950"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Latest notifications"
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-ivory-300 bg-white text-ink-900 shadow-lift"
        >
          <div className="flex items-center justify-between border-b border-ivory-300 px-4 py-3">
            <h2 className="font-display text-xl font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={unread === 0 || markAllRead.isPending}
              className="text-xs font-semibold text-gold-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-ink-400 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[22rem] divide-y divide-ivory-300 overflow-y-auto">
            {latest.isPending ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : latest.isError ? (
              <p className="px-4 py-6 text-center text-sm text-ink-600">
                We could not load your notifications.
              </p>
            ) : latest.data.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-600">
                You are all caught up. Updates about your bookings will appear here.
              </p>
            ) : (
              latest.data.items.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  compact
                  onOpen={item => {
                    setOpen(false);
                    openNotification(item);
                  }}
                />
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-ivory-300 px-4 py-3 text-center text-sm font-semibold text-ink-900 hover:bg-ivory-200"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}

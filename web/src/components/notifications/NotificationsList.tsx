'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BellOff } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotificationActions } from '@/hooks/useNotificationActions';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Notification, Page } from '@/types';
import { NotificationItem } from './NotificationItem';

const PAGE_SIZE = 10;

export function NotificationsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const unread = useUnreadCount();
  const { open, markAllRead } = useNotificationActions();

  const params = { page, pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => api.get<Page<Notification>>('/api/notifications', params),
    placeholderData: keepPreviousData,
  });

  if (list.isError && !list.data) {
    return <ErrorState onRetry={() => void list.refetch()} />;
  }
  if (list.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2, 3].map(index => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (list.data.items.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="No notifications yet"
        description="We will let you know here, and by email, whenever the status of a booking changes."
        action={<ButtonLink href="/vehicles">Browse vehicles</ButtonLink>}
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-ink-600">
          {unread > 0 ? `${unread} unread` : 'You are all caught up'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={unread === 0}
          loading={markAllRead.isPending}
        >
          Mark all as read
        </Button>
      </div>
      <Card className="overflow-hidden">
        <ul className={`divide-y divide-ivory-300 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          {list.data.items.map(notification => (
            <li key={notification.id}>
              <NotificationItem notification={notification} onOpen={open} />
            </li>
          ))}
        </ul>
      </Card>
      <Pagination
        className="mt-8"
        page={list.data.page}
        totalPages={list.data.totalPages}
        onPageChange={next => router.push(next > 1 ? `${pathname}?page=${next}` : pathname)}
      />
    </>
  );
}

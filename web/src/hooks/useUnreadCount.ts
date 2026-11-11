'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/AuthProvider';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

const POLL_INTERVAL_MS = 60_000;

/** Unread notification badge for the signed-in customer; polls once a minute. */
export function useUnreadCount(): number {
  const { role } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.notifications.unread(),
    queryFn: () => api.get<{ count: number }>('/api/notifications/unread-count'),
    enabled: role === 'CUSTOMER',
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  return query.data?.count ?? 0;
}

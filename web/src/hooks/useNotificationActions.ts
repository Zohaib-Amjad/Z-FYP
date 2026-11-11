'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Notification } from '@/types';

/** Mark-as-read actions shared by the header bell and the notifications page. */
export function useNotificationActions() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch<Notification>(`/api/notifications/${id}/read`),
    onSettled: refresh,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch<{ updated: number }>('/api/notifications/read-all'),
    onSuccess: () => toast.success('All notifications marked as read.'),
    onError: () => toast.error('We could not update your notifications. Please try again.'),
    onSettled: refresh,
  });

  /** Marks one notification read and opens the booking it is about. */
  const open = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    if (notification.bookingId) router.push(`/my-bookings/${notification.bookingId}`);
  };

  return { open, markAllRead };
}

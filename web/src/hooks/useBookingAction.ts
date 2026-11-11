'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { actionPayload, withStatusAfter, type ActionInput } from '@/lib/adminBookings';
import { describeAdminActionProblem } from '@/lib/booking';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminBooking, AdminBookingDetail, BookingAction, Page } from '@/types';

interface ActionRequest {
  bookingId: string;
  action: BookingAction;
  input: ActionInput;
}

const SUCCESS: Record<BookingAction, string> = {
  approve: 'Booking approved. The customer has been notified.',
  reject: 'Booking rejected. The customer has been notified.',
  reschedule: 'Booking rescheduled. The customer has been notified.',
  cancel: 'Booking cancelled. The customer has been notified.',
  complete: 'Test drive marked as completed.',
};

type Snapshot = [QueryKey, unknown][];

/**
 * Runs a staff action on a booking. Every cached list and the detail view show the new status
 * at once; if the server refuses (for example someone else already changed the booking) they roll
 * back, the reason is explained and everything is refreshed.
 */
export function useBookingAction() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ bookingId, action, input }: ActionRequest) =>
      api.patch<AdminBooking>(
        `/api/admin/bookings/${bookingId}/${action}`,
        actionPayload(action, input),
      ),

    onMutate: async ({ bookingId, action }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.admin.all });
      const snapshot: Snapshot = [];

      const lists = queryClient.getQueriesData<Page<AdminBooking>>({
        queryKey: ['admin', 'bookings'],
      });
      for (const [key, data] of lists) {
        if (!data) continue;
        snapshot.push([key, data]);
        queryClient.setQueryData<Page<AdminBooking>>(key, {
          ...data,
          items: data.items.map(item =>
            item.id === bookingId ? withStatusAfter(item, action) : item,
          ),
        });
      }
      const detailKey = queryKeys.admin.booking(bookingId);
      const detail = queryClient.getQueryData<AdminBookingDetail>(detailKey);
      if (detail) {
        snapshot.push([detailKey, detail]);
        queryClient.setQueryData<AdminBookingDetail>(detailKey, withStatusAfter(detail, action));
      }
      return { snapshot };
    },

    onError: (error, _request, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
      toast.error(describeAdminActionProblem(error));
    },

    onSuccess: (_booking, { action }) => {
      toast.success(SUCCESS[action]);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

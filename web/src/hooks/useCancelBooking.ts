'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { describeCancelProblem } from '@/lib/booking';
import { asCancelled, countsAfterCancel, pageAfterCancel } from '@/lib/myBookings';
import { queryKeys } from '@/lib/queryKeys';
import type { BookingCounts, MyBooking, MyBookingDetail, MyBookingView, Page } from '@/types';

interface CancelInput {
  booking: MyBooking;
  reason: string | null;
}

/**
 * Cancels the customer's own booking. Lists, tab counts and the detail view update at once;
 * if the server refuses, everything rolls back and the reason is explained in a toast.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ booking, reason }: CancelInput) =>
      api.patch<MyBookingDetail>(`/api/bookings/${booking.id}/cancel`, { reason }),

    onMutate: async ({ booking, reason }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings.all });

      const lists = queryClient.getQueriesData<Page<MyBooking>>({ queryKey: ['bookings', 'mine'] });
      const counts = queryClient.getQueryData<BookingCounts>(queryKeys.bookings.counts());
      const detail = queryClient.getQueryData<MyBookingDetail>(
        queryKeys.bookings.detail(booking.id),
      );

      for (const [key, data] of lists) {
        const view = (key[2] as { view?: MyBookingView } | undefined)?.view ?? 'all';
        if (data) queryClient.setQueryData(key, pageAfterCancel(data, view, booking.id, reason));
      }
      if (counts) {
        queryClient.setQueryData(
          queryKeys.bookings.counts(),
          countsAfterCancel(counts, booking.status),
        );
      }
      if (detail) {
        queryClient.setQueryData<MyBookingDetail>(queryKeys.bookings.detail(booking.id), {
          ...asCancelled(detail, reason),
          statusHistory: detail.statusHistory,
        });
      }
      return { lists, counts, detail, bookingId: booking.id };
    },

    onError: (error, _input, context) => {
      if (context) {
        for (const [key, data] of context.lists) queryClient.setQueryData(key, data);
        if (context.counts) queryClient.setQueryData(queryKeys.bookings.counts(), context.counts);
        if (context.detail) {
          queryClient.setQueryData(queryKeys.bookings.detail(context.bookingId), context.detail);
        }
      }
      toast.error(describeCancelProblem(error));
    },

    onSuccess: () => {
      toast.success('Your appointment has been cancelled.');
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

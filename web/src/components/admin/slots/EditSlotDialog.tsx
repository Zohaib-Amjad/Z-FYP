'use client';

import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { FormAlert } from '@/components/auth/FormAlert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { localToIso, slotTimesSchema } from '@/lib/adminSchemas';
import { api, ApiError } from '@/lib/api';
import { describeSlotProblem } from '@/lib/booking';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminSlot } from '@/types';

interface Blocked {
  message: string;
}

function EditForm({ slot, onClose }: { slot: AdminSlot; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);

  const { form, submit, formError } = useApiForm({
    schema: slotTimesSchema,
    defaultValues: {
      date: format(start, 'yyyy-MM-dd'),
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm'),
    },
    onError: error => {
      if (error instanceof ApiError && error.code === 'HAS_ACTIVE_BOOKINGS') {
        setBlocked({ message: error.message });
        return true;
      }
      const text = describeSlotProblem(error);
      setProblem(text);
      return text !== null;
    },
    onSubmit: async values => {
      setBlocked(null);
      setProblem(null);
      await api.patch(`/api/admin/slots/${slot.id}`, {
        startAt: localToIso(values.date, values.startTime),
        endAt: localToIso(values.date, values.endTime),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      toast.success('Time slot updated.');
      onClose();
    },
  });
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form method="post" onSubmit={submit} noValidate className="space-y-5">
      <p className="rounded-control bg-ivory-200 px-3.5 py-2.5 text-sm text-ink-800">
        {slot.vehicle.manufacturer} {slot.vehicle.model} at {slot.dealership.name}
      </p>
      {blocked ? (
        <div
          role="alert"
          className="rounded-control border border-status-rejected/30 bg-[#fdf6f6] px-4 py-3 text-sm text-status-rejected"
        >
          <p>{blocked.message}</p>
          <p className="mt-1">
            The booking must be rescheduled or cancelled before this slot can change.
          </p>
          {slot.activeBooking ? (
            <Link
              href={`/admin/bookings/${slot.activeBooking.id}`}
              className="mt-1 inline-block font-semibold underline-offset-4 hover:underline"
            >
              Open the booking
            </Link>
          ) : null}
        </div>
      ) : null}
      <FormAlert message={problem ?? formError} />
      <FormField label="Date" error={errors.date?.message} required>
        {c => <Input {...c} type="date" {...register('date')} />}
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Start time" error={errors.startTime?.message} required>
          {c => <Input {...c} type="time" {...register('startTime')} />}
        </FormField>
        <FormField label="End time" error={errors.endTime?.message} required>
          {c => <Input {...c} type="time" {...register('endTime')} />}
        </FormField>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save times'}
        </Button>
      </div>
    </form>
  );
}

export function EditSlotDialog({ slot, onClose }: { slot: AdminSlot | null; onClose: () => void }) {
  return (
    <Modal
      open={slot !== null}
      onClose={onClose}
      title="Edit time slot"
      description="Times are shown in your local time zone."
    >
      {slot ? <EditForm key={slot.id} slot={slot} onClose={onClose} /> : null}
    </Modal>
  );
}

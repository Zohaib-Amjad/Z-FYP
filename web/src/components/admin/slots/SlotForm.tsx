'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormAlert } from '@/components/auth/FormAlert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { localToIso, slotSchema } from '@/lib/adminSchemas';
import { api } from '@/lib/api';
import { describeSlotProblem } from '@/lib/booking';
import { queryKeys } from '@/lib/queryKeys';
import { useSlotOptions } from './useSlotOptions';

export function SlotForm() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const options = useSlotOptions();
  const [problem, setProblem] = useState<string | null>(null);

  const { form, submit, formError } = useApiForm({
    schema: slotSchema,
    defaultValues: {
      dealershipId: '',
      vehicleId: '',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
    },
    onError: error => {
      const text = describeSlotProblem(error);
      setProblem(text);
      return text !== null;
    },
    onSubmit: async values => {
      setProblem(null);
      await api.post('/api/admin/slots', {
        dealershipId: values.dealershipId,
        vehicleId: values.vehicleId,
        startAt: localToIso(values.date, values.startTime),
        endAt: localToIso(values.date, values.endTime),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      form.reset(values);
      toast.success('Time slot created.');
      router.push('/admin/slots');
    },
  });
  const {
    register,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  useUnsavedChangesGuard(isDirty && !isSubmitting);

  return (
    <Card className="max-w-2xl">
      <form method="post" onSubmit={submit} noValidate>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">New time slot</h2>
          <p className="mt-1 text-sm text-ink-600">
            Times are in your local time zone. The vehicle must be offered at the showroom, and
            slots of one vehicle cannot overlap.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          <FormAlert message={problem ?? formError} />
          <FormField label="Showroom" error={errors.dealershipId?.message} required>
            {c => (
              <Select {...c} disabled={options.loading} {...register('dealershipId')}>
                <option value="">Select a showroom</option>
                {options.dealerships.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}, {item.city}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Vehicle" error={errors.vehicleId?.message} required>
            {c => (
              <Select {...c} disabled={options.loading} {...register('vehicleId')}>
                <option value="">Select a vehicle</option>
                {options.vehicles.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.manufacturer} {item.model}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
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
        </CardBody>
        <CardFooter className="flex flex-wrap items-center justify-end gap-3">
          <ButtonLink href="/admin/slots" variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create slot'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

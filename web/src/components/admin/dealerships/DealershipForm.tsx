'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormAlert } from '@/components/auth/FormAlert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import {
  dealershipSchema,
  toDealershipPayload,
  type DealershipFormValues,
} from '@/lib/adminSchemas';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminDealership } from '@/types';

const EMPTY: DealershipFormValues = {
  name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  openingHours: '',
  description: '',
};

export function DealershipForm({ dealership }: { dealership?: AdminDealership }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const defaults: DealershipFormValues = dealership
    ? {
        name: dealership.name,
        address: dealership.address,
        city: dealership.city,
        phone: dealership.phone,
        email: dealership.email,
        openingHours: dealership.openingHours,
        description: dealership.description ?? '',
      }
    : EMPTY;

  const { form, submit, formError } = useApiForm({
    schema: dealershipSchema,
    defaultValues: defaults,
    onSubmit: async values => {
      const payload = toDealershipPayload(values);
      if (dealership) {
        await api.patch(`/api/admin/dealerships/${dealership.id}`, payload);
        await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dealerships.all });
        form.reset(values);
        toast.success('Showroom details saved.');
      } else {
        const created = await api.post<AdminDealership>('/api/admin/dealerships', payload);
        await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
        form.reset(values);
        toast.success('Showroom added.');
        router.push(`/admin/dealerships/${created.id}`);
      }
    },
  });
  const {
    register,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  useUnsavedChangesGuard(isDirty && !isSubmitting);

  return (
    <Card>
      <form method="post" onSubmit={submit} noValidate>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">
            {dealership ? 'Showroom details' : 'New showroom'}
          </h2>
        </CardHeader>
        <CardBody className="space-y-5">
          <FormAlert message={formError} />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Name" error={errors.name?.message} required className="sm:col-span-2">
              {c => <Input {...c} {...register('name')} />}
            </FormField>
            <FormField label="Address" error={errors.address?.message} required>
              {c => <Input {...c} autoComplete="off" {...register('address')} />}
            </FormField>
            <FormField label="City" error={errors.city?.message} required>
              {c => <Input {...c} autoComplete="off" {...register('city')} />}
            </FormField>
            <FormField label="Phone" error={errors.phone?.message} required>
              {c => <Input {...c} type="tel" {...register('phone')} />}
            </FormField>
            <FormField label="Email" error={errors.email?.message} required>
              {c => <Input {...c} type="email" {...register('email')} />}
            </FormField>
            <FormField
              label="Opening hours"
              hint="e.g. Mon-Fri 09:00-18:00, Sat 09:00-14:00"
              error={errors.openingHours?.message}
              required
              className="sm:col-span-2"
            >
              {c => <Input {...c} {...register('openingHours')} />}
            </FormField>
            <FormField
              label="Description"
              hint={`Optional. ${watch('description').length} of 1000 characters`}
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              {c => <Textarea {...c} rows={4} {...register('description')} />}
            </FormField>
          </div>
        </CardBody>
        <CardFooter className="flex flex-wrap items-center justify-end gap-3">
          {dealership ? (
            <Button
              variant="ghost"
              onClick={() => form.reset(defaults)}
              disabled={!isDirty || isSubmitting}
            >
              Discard changes
            </Button>
          ) : (
            <ButtonLink href="/admin/dealerships" variant="ghost">
              Cancel
            </ButtonLink>
          )}
          <Button type="submit" loading={isSubmitting} disabled={Boolean(dealership) && !isDirty}>
            {isSubmitting ? 'Saving…' : dealership ? 'Save changes' : 'Add showroom'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

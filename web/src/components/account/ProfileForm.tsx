'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { FormAlert } from '@/components/auth/FormAlert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { api } from '@/lib/api';
import { profileSchema } from '@/lib/schemas';
import type { User } from '@/types';

export function ProfileForm({ user }: { user: User }) {
  const toast = useToast();
  const { setUser } = useAuth();

  const { form, submit, formError } = useApiForm({
    schema: profileSchema,
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      drivingLicenseNumber: user.drivingLicenseNumber ?? '',
    },
    onSubmit: async values => {
      const updated = await api.patch<User>('/api/profile', {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        drivingLicenseNumber: values.drivingLicenseNumber || null,
      });
      setUser(updated);
      form.reset({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone ?? '',
        drivingLicenseNumber: updated.drivingLicenseNumber ?? '',
      });
      toast.success('Your profile has been updated.');
    },
  });
  const {
    register,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  useUnsavedChangesGuard(isDirty);

  return (
    <Card>
      <form method="post" onSubmit={submit} noValidate>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">Personal information</h2>
          <p className="mt-1 text-sm text-ink-600">
            Our showroom team uses these details to prepare for your appointment.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          <FormAlert message={formError} />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="First name" error={errors.firstName?.message} required>
              {control => (
                <Input {...control} autoComplete="given-name" {...register('firstName')} />
              )}
            </FormField>
            <FormField label="Last name" error={errors.lastName?.message} required>
              {control => (
                <Input {...control} autoComplete="family-name" {...register('lastName')} />
              )}
            </FormField>
          </div>
          <FormField
            label="Email address"
            hint="Your email is your sign-in identity, so it cannot be changed here. Contact the showroom if it needs correcting."
          >
            {control => <Input {...control} type="email" value={user.email} readOnly disabled />}
          </FormField>
          <FormField label="Phone number" error={errors.phone?.message} required>
            {control => <Input {...control} type="tel" autoComplete="tel" {...register('phone')} />}
          </FormField>
          <FormField
            label="Driving licence number"
            hint="Optional. Clear the field to remove it from your profile."
            error={errors.drivingLicenseNumber?.message}
          >
            {control => (
              <Input {...control} autoComplete="off" {...register('drivingLicenseNumber')} />
            )}
          </FormField>
        </CardBody>
        <CardFooter className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => reset()} disabled={!isDirty || isSubmitting}>
            Discard changes
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

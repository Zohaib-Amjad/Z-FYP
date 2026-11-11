'use client';

import { FormAlert } from '@/components/auth/FormAlert';
import { PasswordInput, PasswordRules } from '@/components/auth/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { api } from '@/lib/api';
import { changePasswordSchema } from '@/lib/schemas';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordForm() {
  const toast = useToast();

  const { form, submit, formError } = useApiForm({
    schema: changePasswordSchema,
    defaultValues: EMPTY,
    codeFields: { INVALID_CURRENT_PASSWORD: 'currentPassword' },
    onSubmit: async values => {
      await api.patch<null>('/api/profile/password', values);
      form.reset(EMPTY);
      toast.success('Your password has been changed.');
    },
  });
  const {
    register,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <Card>
      <form method="post" onSubmit={submit} noValidate>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-ink-600">
            Choose a password you do not use anywhere else.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          <FormAlert message={formError} />
          <FormField label="Current password" error={errors.currentPassword?.message} required>
            {control => (
              <PasswordInput
                {...control}
                autoComplete="current-password"
                {...register('currentPassword')}
              />
            )}
          </FormField>
          <div>
            <FormField label="New password" error={errors.newPassword?.message} required>
              {control => (
                <PasswordInput
                  {...control}
                  autoComplete="new-password"
                  {...register('newPassword')}
                />
              )}
            </FormField>
            <PasswordRules value={watch('newPassword')} />
          </div>
          <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
            {control => (
              <PasswordInput
                {...control}
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            )}
          </FormField>
        </CardBody>
        <CardFooter className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

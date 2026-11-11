'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { api } from '@/lib/api';
import { safeRedirectTarget } from '@/lib/routeAccess';
import { registerSchema } from '@/lib/schemas';
import type { User } from '@/types';
import { FormAlert } from './FormAlert';
import { PasswordInput, PasswordRules } from './PasswordInput';

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { setUser } = useAuth();

  const { form, submit, formError } = useApiForm({
    schema: registerSchema,
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      drivingLicenseNumber: '',
      password: '',
      confirmPassword: '',
    },
    codeFields: { EMAIL_TAKEN: 'email' },
    onSubmit: async values => {
      const { drivingLicenseNumber, ...rest } = values;
      const user = await api.post<User>('/api/auth/register', {
        ...rest,
        ...(drivingLicenseNumber ? { drivingLicenseNumber } : {}),
      });
      setUser(user);
      toast.success(`Welcome to Prestige, ${user.firstName}. Your account is ready.`);
      router.replace(safeRedirectTarget(next, '/vehicles'));
      router.refresh();
    },
  });
  const {
    register,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form method="post" onSubmit={submit} noValidate className="space-y-5">
      <FormAlert message={formError} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="First name" error={errors.firstName?.message} required>
          {control => <Input {...control} autoComplete="given-name" {...register('firstName')} />}
        </FormField>
        <FormField label="Last name" error={errors.lastName?.message} required>
          {control => <Input {...control} autoComplete="family-name" {...register('lastName')} />}
        </FormField>
      </div>
      <FormField label="Email address" error={errors.email?.message} required>
        {control => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            {...register('email')}
          />
        )}
      </FormField>
      <FormField
        label="Phone number"
        hint="Our showroom team uses this to confirm your appointment."
        error={errors.phone?.message}
        required
      >
        {control => (
          <Input
            {...control}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            {...register('phone')}
          />
        )}
      </FormField>
      <FormField
        label="Driving licence number"
        hint="Optional. You will need your licence at the showroom."
        error={errors.drivingLicenseNumber?.message}
      >
        {control => <Input {...control} autoComplete="off" {...register('drivingLicenseNumber')} />}
      </FormField>
      <div>
        <FormField label="Password" error={errors.password?.message} required>
          {control => (
            <PasswordInput {...control} autoComplete="new-password" {...register('password')} />
          )}
        </FormField>
        <PasswordRules value={watch('password')} />
      </div>
      <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
        {control => (
          <PasswordInput
            {...control}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        )}
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        {isSubmitting ? 'Creating your account…' : 'Create account'}
      </Button>
      <p className="text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="font-semibold text-gold-700 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

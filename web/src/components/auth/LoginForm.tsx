'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { api, ApiError } from '@/lib/api';
import { safeRedirectTarget } from '@/lib/routeAccess';
import { loginSchema } from '@/lib/schemas';
import { FormAlert } from './FormAlert';
import { PasswordInput } from './PasswordInput';

interface LoginFormProps {
  variant: 'customer' | 'staff';
  /** Page the visitor came from; only same-site paths are honoured. */
  next?: string;
  /** True when the visitor was sent here because their session ended. */
  expired?: boolean;
}

const NOT_STAFF_MESSAGE =
  'This account does not have access to the administration portal. Customers can sign in on the main sign-in page.';

export function LoginForm({ variant, next, expired = false }: LoginFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { login, setUser } = useAuth();
  const isStaffForm = variant === 'staff';

  const { form, submit, formError } = useApiForm({
    schema: loginSchema,
    defaultValues: { email: '', password: '' },
    onSubmit: async values => {
      const user = await login(values.email, values.password);
      if (isStaffForm && user.role !== 'STAFF') {
        await api.post<null>('/api/auth/logout').catch(() => undefined);
        setUser(null);
        throw new ApiError(403, 'FORBIDDEN', NOT_STAFF_MESSAGE);
      }
      const target =
        user.role === 'STAFF'
          ? safeRedirectTarget(next?.startsWith('/admin') ? next : null, '/admin')
          : safeRedirectTarget(next, '/vehicles');
      toast.success(`Welcome back, ${user.firstName}.`);
      router.replace(target);
      router.refresh();
    },
  });
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form method="post" onSubmit={submit} noValidate className="space-y-5">
      {expired ? (
        <p role="status" className="rounded-control bg-ivory-200 px-4 py-3 text-sm text-ink-700">
          Your session has ended. Please sign in again to continue.
        </p>
      ) : null}
      <FormAlert message={formError} />
      <FormField label="Email address" error={errors.email?.message} required>
        {control => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            {...register('email')}
          />
        )}
      </FormField>
      <FormField label="Password" error={errors.password?.message} required>
        {control => (
          <PasswordInput {...control} autoComplete="current-password" {...register('password')} />
        )}
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      {isStaffForm ? null : (
        <p className="text-center text-sm text-ink-600">
          New to Prestige?{' '}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
            className="font-semibold text-gold-700 underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      )}
    </form>
  );
}

'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { FormAlert } from '@/components/auth/FormAlert';
import { ActiveBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { generateTemporaryPassword, randomBelow, staffSchema } from '@/lib/adminSchemas';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { Page, User } from '@/types';

const PAGE_SIZE = 12;

function CreateStaffForm() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(
    null,
  );

  const { form, submit, formError } = useApiForm({
    schema: staffSchema,
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '' },
    codeFields: { EMAIL_TAKEN: 'email' },
    onSubmit: async values => {
      await api.post<User>('/api/staff', values);
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      toast.success(`Staff account created for ${values.firstName} ${values.lastName}.`);
      setCreated({
        name: `${values.firstName} ${values.lastName}`,
        email: values.email,
        password: values.password,
      });
      form.reset();
    },
  });
  const {
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  useUnsavedChangesGuard(isDirty && !isSubmitting);

  const generate = () =>
    setValue('password', generateTemporaryPassword(randomBelow), {
      shouldDirty: true,
      shouldValidate: true,
    });

  return (
    <Card>
      <form method="post" onSubmit={submit} noValidate>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">Add a staff account</h2>
          <p className="mt-1 text-sm text-ink-600">
            Staff accounts are created here only; they cannot register themselves. Give the
            temporary password to the new colleague securely and ask them to change it from My
            profile.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          <FormAlert message={formError} />
          {created ? (
            <div
              role="status"
              className="rounded-control border border-status-approved/30 bg-[#e3f4ea] px-4 py-3 text-sm text-ink-800"
            >
              <p className="font-semibold">{created.name} can now sign in.</p>
              <p className="mt-1">
                Email: <strong>{created.email}</strong>
                <br />
                Temporary password: <strong className="font-mono">{created.password}</strong>
              </p>
              <p className="mt-1 text-xs text-ink-600">
                This password is shown only now. It is not stored in readable form.
              </p>
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="First name" error={errors.firstName?.message} required>
              {c => <Input {...c} autoComplete="off" {...register('firstName')} />}
            </FormField>
            <FormField label="Last name" error={errors.lastName?.message} required>
              {c => <Input {...c} autoComplete="off" {...register('lastName')} />}
            </FormField>
            <FormField label="Email address" error={errors.email?.message} required>
              {c => <Input {...c} type="email" autoComplete="off" {...register('email')} />}
            </FormField>
            <FormField label="Phone number" error={errors.phone?.message} required>
              {c => <Input {...c} type="tel" autoComplete="off" {...register('phone')} />}
            </FormField>
            <div className="sm:col-span-2">
              <FormField
                label="Temporary password"
                hint="At least 8 characters with a letter and a number."
                error={errors.password?.message}
                required
              >
                {c => (
                  <div className="flex gap-3">
                    <Input
                      {...c}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono"
                      {...register('password')}
                    />
                    <Button variant="outline" onClick={generate} className="shrink-0">
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      Generate
                    </Button>
                  </div>
                )}
              </FormField>
              <span className="sr-only" aria-live="polite">
                {watch('password') ? 'A password has been entered.' : ''}
              </span>
            </div>
          </div>
        </CardBody>
        <CardFooter className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create staff account'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function StaffView() {
  const [page, setPage] = useState(1);
  const params = { page, pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: [...queryKeys.admin.staff(), params],
    queryFn: () => api.get<Page<User>>('/api/staff', params),
    placeholderData: keepPreviousData,
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: user => (
        <div>
          <p className="font-semibold text-ink-900">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-ink-500">{user.email}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: user => user.phone ?? 'Not provided' },
    { key: 'added', header: 'Added', cell: user => formatDate(user.createdAt) },
    {
      key: 'login',
      header: 'Last sign-in',
      cell: user => (user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Not yet'),
    },
    { key: 'status', header: 'Status', cell: user => <ActiveBadge active={user.isActive} /> },
  ];

  return (
    <div className="space-y-8">
      <CreateStaffForm />
      <section aria-labelledby="staff-list-heading" className="space-y-4">
        <h2 id="staff-list-heading" className="font-display text-2xl font-semibold">
          Current staff
          {list.data ? (
            <span className="ml-2 text-base font-normal text-ink-500">({list.data.total})</span>
          ) : null}
        </h2>
        {list.isError && !list.data ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : (
          <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
            <DataTable
              caption="Staff accounts"
              columns={columns}
              rows={list.data?.items ?? []}
              rowKey={user => user.id}
              loading={list.isPending}
            />
          </div>
        )}
        {list.data ? (
          <Pagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </section>
    </div>
  );
}

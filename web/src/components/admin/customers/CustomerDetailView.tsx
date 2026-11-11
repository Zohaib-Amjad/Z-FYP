'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { ActivationDialog } from '@/components/admin/ActivationDialog';
import { ActiveBadge, StatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { CustomerDetail } from '@/types';

type BookingRow = CustomerDetail['bookings'][number];

export function CustomerDetailView({ customerId }: { customerId: string }) {
  const [dialog, setDialog] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.admin.customer(customerId),
    queryFn: () => api.get<CustomerDetail>(`/api/admin/customers/${customerId}`),
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return missing ? (
      <EmptyState
        headingLevel={1}
        title="Customer not found"
        description="The account may have been removed, or the link may be incorrect."
        action={<ButtonLink href="/admin/customers">Back to customers</ButtonLink>}
      />
    ) : (
      <ErrorState headingLevel={1} onRetry={() => void query.refetch()} />
    );
  }

  const { customer, summary, bookings } = query.data;
  const name = `${customer.firstName} ${customer.lastName}`;
  const mode = customer.isActive ? 'deactivate' : 'activate';

  const columns: Column<BookingRow>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: booking => (
        <Link
          href={`/admin/bookings/${booking.id}`}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {booking.slot.vehicle.manufacturer} {booking.slot.vehicle.model}
        </Link>
      ),
    },
    { key: 'when', header: 'Appointment', cell: booking => formatDateTime(booking.slot.startAt) },
    { key: 'showroom', header: 'Showroom', cell: booking => booking.slot.dealership.name },
    { key: 'status', header: 'Status', cell: booking => <StatusBadge status={booking.status} /> },
    { key: 'requested', header: 'Requested', cell: booking => formatDate(booking.createdAt) },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Customer</p>
          <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <ActiveBadge active={customer.isActive} />
            <span className="text-sm text-ink-600">Joined {formatDate(customer.createdAt)}</span>
          </div>
        </div>
        <Button variant={customer.isActive ? 'outline' : 'primary'} onClick={() => setDialog(true)}>
          {customer.isActive ? 'Deactivate account' : 'Reactivate account'}
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:items-start">
        <Card>
          <CardHeader>
            <h2 className="font-display text-2xl font-semibold">Details</h2>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p className="flex items-center gap-2.5 text-ink-700">
              <Mail className="h-4 w-4 text-gold-700" aria-hidden="true" />
              <a
                href={`mailto:${customer.email}`}
                className="-my-3 inline-block py-3 underline-offset-4 hover:underline"
              >
                {customer.email}
              </a>
            </p>
            <p className="flex items-center gap-2.5 text-ink-700">
              <Phone className="h-4 w-4 text-gold-700" aria-hidden="true" />
              {customer.phone ?? 'No phone number'}
            </p>
            <p className="text-ink-700">
              Driving licence:{' '}
              <strong className="font-semibold text-ink-900">
                {customer.drivingLicenseNumber ?? 'Not provided'}
              </strong>
            </p>
            <p className="text-ink-700">
              Last sign-in:{' '}
              <strong className="font-semibold text-ink-900">
                {customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : 'Never'}
              </strong>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-2xl font-semibold">Booking history</h2>
            <p className="mt-1 text-sm text-ink-600">
              {summary.total} {summary.total === 1 ? 'booking' : 'bookings'} in total
              {Object.entries(summary.byStatus).length > 0
                ? `: ${Object.entries(summary.byStatus)
                    .map(([status, count]) => `${count} ${status.toLowerCase()}`)
                    .join(', ')}`
                : ''}
              .
            </p>
          </CardHeader>
          <CardBody>
            <DataTable
              caption={`Bookings of ${name}`}
              columns={columns}
              rows={bookings}
              rowKey={booking => booking.id}
              empty={
                <p className="text-sm text-ink-600">
                  This customer has not requested a test drive yet.
                </p>
              }
            />
          </CardBody>
        </Card>
      </div>

      <ActivationDialog
        open={dialog}
        onClose={() => setDialog(false)}
        entity="account"
        name={name}
        mode={mode}
        descriptions={{
          deactivate:
            'The customer will be blocked from signing in. Their records and booking history are kept.',
          activate: 'The customer will be able to sign in again.',
        }}
        warning="They will be signed out and unable to sign in, and any of their future bookings that are still active will be cancelled. Past bookings stay in the history."
        request={() =>
          api.patch(`/api/admin/customers/${customer.id}/status`, { isActive: mode === 'activate' })
        }
        successMessage={result => {
          const cancelled =
            (result as { cancelledBookings?: number } | null)?.cancelledBookings ?? 0;
          if (mode === 'activate') return `${name}'s account has been reactivated.`;
          return cancelled > 0
            ? `${name}'s account has been deactivated and ${cancelled} upcoming ${cancelled === 1 ? 'booking was' : 'bookings were'} cancelled.`
            : `${name}'s account has been deactivated.`;
        }}
      />
    </div>
  );
}

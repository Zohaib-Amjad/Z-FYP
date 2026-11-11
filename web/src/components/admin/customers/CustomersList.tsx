'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { DebouncedInput } from '@/components/catalog/DebouncedInput';
import { ActiveBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  CUSTOMER_SORTS,
  DEFAULT_CUSTOMER_FILTERS,
  parseCustomerFilters,
  toCustomerApiQuery,
  type ActiveFilter,
  type CustomerListFilters,
} from '@/lib/adminLists';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { Customer, Page } from '@/types';

export function CustomersList() {
  const { filters, change, navigate } = useUrlFilters(
    parseCustomerFilters,
    DEFAULT_CUSTOMER_FILTERS,
  );
  const apiQuery = toCustomerApiQuery(filters);
  const list = useQuery({
    queryKey: queryKeys.admin.customers(apiQuery),
    queryFn: () => api.get<Page<Customer>>('/api/admin/customers', apiQuery),
    placeholderData: keepPreviousData,
  });
  const hasFilters = filters.q !== '' || filters.isActive !== '';

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      cell: customer => (
        <div className="min-w-0">
          <Link
            href={`/admin/customers/${customer.id}`}
            className="font-semibold text-ink-900 underline-offset-4 hover:underline"
          >
            {customer.firstName} {customer.lastName}
          </Link>
          <p className="truncate text-xs text-ink-500">{customer.email}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: customer => customer.phone ?? 'Not provided' },
    { key: 'bookings', header: 'Bookings', cell: customer => customer.bookingCount ?? 0 },
    {
      key: 'last',
      header: 'Last booking',
      cell: customer => (customer.lastBookingAt ? formatDate(customer.lastBookingAt) : 'None yet'),
    },
    { key: 'joined', header: 'Joined', cell: customer => formatDate(customer.createdAt) },
    {
      key: 'status',
      header: 'Status',
      cell: customer => <ActiveBadge active={customer.isActive} />,
    },
  ];

  return (
    <div className="space-y-6">
      <form
        role="search"
        aria-label="Filter customers"
        onSubmit={event => event.preventDefault()}
        className="grid gap-4 rounded-card border border-ivory-300 bg-white p-4 shadow-soft sm:grid-cols-3 sm:items-end sm:p-5"
      >
        <FormField label="Search">
          {c => (
            <DebouncedInput
              {...c}
              type="search"
              placeholder="Name, email or phone"
              value={filters.q}
              onCommit={q => change({ q }, 'replace')}
            />
          )}
        </FormField>
        <FormField label="Status">
          {c => (
            <Select
              {...c}
              value={filters.isActive}
              onChange={event => change({ isActive: event.target.value as ActiveFilter })}
            >
              <option value="">Active and deactivated</option>
              <option value="true">Active only</option>
              <option value="false">Deactivated only</option>
            </Select>
          )}
        </FormField>
        <FormField label="Sort by">
          {c => (
            <Select
              {...c}
              value={filters.sort}
              onChange={event =>
                change({ sort: event.target.value as CustomerListFilters['sort'] })
              }
            >
              {CUSTOMER_SORTS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </form>

      <p aria-live="polite" className="text-sm font-medium text-ink-700">
        {list.data
          ? `${list.data.total} ${list.data.total === 1 ? 'customer' : 'customers'}`
          : 'Loading customers…'}
      </p>

      {list.isError && !list.data ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (
        <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <DataTable
            caption="Customers"
            columns={columns}
            rows={list.data?.items ?? []}
            rowKey={customer => customer.id}
            loading={list.isPending}
            empty={
              <EmptyState
                icon={UsersRound}
                title="No customers found"
                description={
                  hasFilters
                    ? 'Try a different search or clear the filters.'
                    : 'Customers appear here once they register.'
                }
                action={
                  hasFilters ? (
                    <Button onClick={() => navigate(DEFAULT_CUSTOMER_FILTERS)}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </div>
      )}

      {list.data ? (
        <Pagination
          page={list.data.page}
          totalPages={list.data.totalPages}
          onPageChange={page => change({ page })}
        />
      ) : null}
    </div>
  );
}

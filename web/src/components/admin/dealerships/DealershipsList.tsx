'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { ActivationDialog } from '@/components/admin/ActivationDialog';
import { DebouncedInput } from '@/components/catalog/DebouncedInput';
import { ActiveBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  DEFAULT_DEALERSHIP_FILTERS,
  parseDealershipFilters,
  toDealershipApiQuery,
  type ActiveFilter,
} from '@/lib/adminLists';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminDealership, Page } from '@/types';

interface Target {
  dealership: AdminDealership;
  mode: 'activate' | 'deactivate';
}

export function DealershipsList() {
  const { filters, change, navigate } = useUrlFilters(
    parseDealershipFilters,
    DEFAULT_DEALERSHIP_FILTERS,
  );
  const [target, setTarget] = useState<Target | null>(null);

  const apiQuery = toDealershipApiQuery(filters);
  const list = useQuery({
    queryKey: queryKeys.admin.dealerships(apiQuery),
    queryFn: () => api.get<Page<AdminDealership>>('/api/admin/dealerships', apiQuery),
    placeholderData: keepPreviousData,
  });
  const hasFilters = filters.q !== '' || filters.isActive !== '';

  const columns: Column<AdminDealership>[] = [
    {
      key: 'name',
      header: 'Showroom',
      cell: dealership => (
        <div>
          <Link
            href={`/admin/dealerships/${dealership.id}`}
            className="font-semibold text-ink-900 underline-offset-4 hover:underline"
          >
            {dealership.name}
          </Link>
          <p className="text-xs text-ink-500">{dealership.address}</p>
        </div>
      ),
    },
    { key: 'city', header: 'City', cell: dealership => dealership.city },
    {
      key: 'contact',
      header: 'Contact',
      cell: dealership => (
        <div>
          <p>{dealership.phone}</p>
          <p className="text-xs text-ink-500">{dealership.email}</p>
        </div>
      ),
    },
    { key: 'vehicles', header: 'Vehicles', cell: dealership => dealership.vehicleCount },
    {
      key: 'status',
      header: 'Status',
      cell: dealership => <ActiveBadge active={dealership.isActive} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: dealership => (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/admin/dealerships/${dealership.id}`} variant="outline" size="sm">
            Edit
          </ButtonLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setTarget({ dealership, mode: dealership.isActive ? 'deactivate' : 'activate' })
            }
          >
            {dealership.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <form
        role="search"
        aria-label="Filter showrooms"
        onSubmit={event => event.preventDefault()}
        className="grid gap-4 rounded-card border border-ivory-300 bg-white p-4 shadow-soft sm:grid-cols-[2fr_1fr_auto] sm:items-end sm:p-5"
      >
        <FormField label="Search">
          {control => (
            <DebouncedInput
              {...control}
              type="search"
              placeholder="Name, city or address"
              value={filters.q}
              onCommit={q => change({ q }, 'replace')}
            />
          )}
        </FormField>
        <FormField label="Status">
          {control => (
            <Select
              {...control}
              value={filters.isActive}
              onChange={event => change({ isActive: event.target.value as ActiveFilter })}
            >
              <option value="">Active and inactive</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </Select>
          )}
        </FormField>
        <ButtonLink href="/admin/dealerships/new">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add showroom
        </ButtonLink>
      </form>

      <p aria-live="polite" className="text-sm font-medium text-ink-700">
        {list.data
          ? `${list.data.total} ${list.data.total === 1 ? 'showroom' : 'showrooms'}`
          : 'Loading showrooms…'}
      </p>

      {list.isError && !list.data ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (
        <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <DataTable
            caption="Showrooms"
            columns={columns}
            rows={list.data?.items ?? []}
            rowKey={dealership => dealership.id}
            loading={list.isPending}
            empty={
              <EmptyState
                icon={Building2}
                title="No showrooms found"
                description={hasFilters ? 'Try clearing a filter.' : 'Add your first showroom.'}
                action={
                  hasFilters ? (
                    <Button onClick={() => navigate(DEFAULT_DEALERSHIP_FILTERS)}>
                      Clear filters
                    </Button>
                  ) : (
                    <ButtonLink href="/admin/dealerships/new">Add showroom</ButtonLink>
                  )
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

      {target ? (
        <ActivationDialog
          open
          onClose={() => setTarget(null)}
          entity="showroom"
          name={target.dealership.name}
          mode={target.mode}
          bookingsHref={`/admin/bookings?dealershipId=${target.dealership.id}&status=PENDING,APPROVED,RESCHEDULED&sort=slotStartAsc`}
          request={() => api.patch(`/api/admin/dealerships/${target.dealership.id}/${target.mode}`)}
        />
      ) : null}
    </div>
  );
}

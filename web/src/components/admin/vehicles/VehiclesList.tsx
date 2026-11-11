'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Car, Plus } from 'lucide-react';
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
  DEFAULT_VEHICLE_FILTERS,
  VEHICLE_SORTS,
  parseVehicleFilters,
  toVehicleApiQuery,
  type ActiveFilter,
  type VehicleListFilters,
} from '@/lib/adminLists';
import { api } from '@/lib/api';
import { enumLabel, formatPrice } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { FUEL_TYPES, VEHICLE_TYPES, type AdminVehicle, type Page } from '@/types';

interface Target {
  vehicle: AdminVehicle;
  mode: 'activate' | 'deactivate';
}

export function VehiclesList() {
  const { filters, change, navigate } = useUrlFilters(parseVehicleFilters, DEFAULT_VEHICLE_FILTERS);
  const [target, setTarget] = useState<Target | null>(null);

  const apiQuery = toVehicleApiQuery(filters);
  const list = useQuery({
    queryKey: queryKeys.admin.vehicles(apiQuery),
    queryFn: () => api.get<Page<AdminVehicle>>('/api/admin/vehicles', apiQuery),
    placeholderData: keepPreviousData,
  });

  const hasFilters =
    JSON.stringify({ ...filters, page: 1, sort: '' }) !==
    JSON.stringify({ ...DEFAULT_VEHICLE_FILTERS, sort: '' });

  const columns: Column<AdminVehicle>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: vehicle => (
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-control bg-ink-900">
            {vehicle.primaryImage ? (
              <Image
                src={vehicle.primaryImage.url}
                alt=""
                fill
                sizes="80px"
                unoptimized={vehicle.primaryImage.url.endsWith('.svg')}
                className="object-cover"
              />
            ) : (
              <Car className="m-auto h-5 w-5 text-ink-500" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/vehicles/${vehicle.id}`}
              className="font-semibold text-ink-900 underline-offset-4 hover:underline"
            >
              {vehicle.manufacturer} {vehicle.model}
            </Link>
            <p className="text-xs text-ink-500">{vehicle.year}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: vehicle => `${enumLabel(vehicle.vehicleType)} · ${enumLabel(vehicle.fuelType)}`,
    },
    { key: 'price', header: 'From', cell: vehicle => formatPrice(vehicle.priceFrom) },
    { key: 'showrooms', header: 'Showrooms', cell: vehicle => vehicle.dealershipCount },
    { key: 'status', header: 'Status', cell: vehicle => <ActiveBadge active={vehicle.isActive} /> },
    {
      key: 'actions',
      header: 'Actions',
      cell: vehicle => (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/admin/vehicles/${vehicle.id}`} variant="outline" size="sm">
            Edit
          </ButtonLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setTarget({ vehicle, mode: vehicle.isActive ? 'deactivate' : 'activate' })
            }
          >
            {vehicle.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <form
        role="search"
        aria-label="Filter vehicles"
        onSubmit={event => event.preventDefault()}
        className="grid gap-4 rounded-card border border-ivory-300 bg-white p-4 shadow-soft sm:grid-cols-2 sm:p-5 xl:grid-cols-5"
      >
        <FormField label="Search" className="xl:col-span-2">
          {control => (
            <DebouncedInput
              {...control}
              type="search"
              placeholder="Manufacturer, model or colour"
              value={filters.q}
              onCommit={q => change({ q }, 'replace')}
            />
          )}
        </FormField>
        <FormField label="Type">
          {control => (
            <Select
              {...control}
              value={filters.vehicleType}
              onChange={event =>
                change({ vehicleType: event.target.value as VehicleListFilters['vehicleType'] })
              }
            >
              <option value="">All types</option>
              {VEHICLE_TYPES.map(type => (
                <option key={type} value={type}>
                  {enumLabel(type)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Fuel">
          {control => (
            <Select
              {...control}
              value={filters.fuelType}
              onChange={event =>
                change({ fuelType: event.target.value as VehicleListFilters['fuelType'] })
              }
            >
              <option value="">All fuel types</option>
              {FUEL_TYPES.map(fuel => (
                <option key={fuel} value={fuel}>
                  {enumLabel(fuel)}
                </option>
              ))}
            </Select>
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
        <FormField label="Sort by" className="xl:col-span-2">
          {control => (
            <Select
              {...control}
              value={filters.sort}
              onChange={event => change({ sort: event.target.value as VehicleListFilters['sort'] })}
            >
              {VEHICLE_SORTS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="flex items-end gap-3 xl:col-span-3 xl:justify-end">
          <Button
            variant="ghost"
            disabled={!hasFilters}
            onClick={() => navigate({ ...DEFAULT_VEHICLE_FILTERS, sort: filters.sort })}
          >
            Clear filters
          </Button>
          <ButtonLink href="/admin/vehicles/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add vehicle
          </ButtonLink>
        </div>
      </form>

      <p aria-live="polite" className="text-sm font-medium text-ink-700">
        {list.data
          ? `${list.data.total} ${list.data.total === 1 ? 'vehicle' : 'vehicles'}`
          : 'Loading vehicles…'}
      </p>

      {list.isError && !list.data ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (
        <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <DataTable
            caption="Vehicles"
            columns={columns}
            rows={list.data?.items ?? []}
            rowKey={vehicle => vehicle.id}
            loading={list.isPending}
            empty={
              <EmptyState
                icon={Car}
                title="No vehicles found"
                description={
                  hasFilters ? 'Try clearing a filter.' : 'Add the first vehicle to the collection.'
                }
                action={
                  hasFilters ? (
                    <Button onClick={() => navigate(DEFAULT_VEHICLE_FILTERS)}>Clear filters</Button>
                  ) : (
                    <ButtonLink href="/admin/vehicles/new">Add vehicle</ButtonLink>
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
          entity="vehicle"
          name={`${target.vehicle.manufacturer} ${target.vehicle.model}`}
          mode={target.mode}
          bookingsHref={`/admin/bookings?vehicleId=${target.vehicle.id}&status=PENDING,APPROVED,RESCHEDULED&sort=slotStartAsc`}
          request={() => api.patch(`/api/admin/vehicles/${target.vehicle.id}/${target.mode}`)}
        />
      ) : null}
    </div>
  );
}

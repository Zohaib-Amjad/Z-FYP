'use client';

import { useQuery } from '@tanstack/react-query';
import { DebouncedInput } from '@/components/catalog/DebouncedInput';
import { STATUS_LABELS } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  ADMIN_SORTS,
  DEFAULT_ADMIN_FILTERS,
  type AdminFilters,
  type AdminSort,
} from '@/lib/adminBookings';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queryKeys';
import {
  BOOKING_STATUSES,
  type BookingStatus,
  type Dealership,
  type Page,
  type VehicleListItem,
} from '@/types';

interface BookingFiltersProps {
  filters: AdminFilters;
  onChange: (change: Partial<AdminFilters>) => void;
  onSearch: (q: string) => void;
}

const OPTIONS_STALE_MS = 5 * 60_000;

export function BookingFilters({ filters, onChange, onSearch }: BookingFiltersProps) {
  const dealerships = useQuery({
    queryKey: queryKeys.dealerships.list(),
    queryFn: () => api.get<Dealership[]>('/api/dealerships'),
    staleTime: OPTIONS_STALE_MS,
  });
  const vehicleParams = { pageSize: 50, sort: 'manufacturerAsc' };
  const vehicles = useQuery({
    queryKey: queryKeys.vehicles.list(vehicleParams),
    queryFn: () => api.get<Page<VehicleListItem>>('/api/vehicles', vehicleParams),
    staleTime: OPTIONS_STALE_MS,
  });

  const toggleStatus = (status: BookingStatus) => {
    const next = filters.status.includes(status)
      ? filters.status.filter(item => item !== status)
      : [...filters.status, status];
    onChange({ status: next });
  };

  const isDefault =
    JSON.stringify({ ...filters, page: 1 }) === JSON.stringify(DEFAULT_ADMIN_FILTERS);

  return (
    <form
      role="search"
      aria-label="Filter bookings"
      onSubmit={event => event.preventDefault()}
      className="space-y-4 rounded-card border border-ivory-300 bg-white p-4 shadow-soft sm:p-5"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">Status</legend>
        <div className="flex flex-wrap gap-2">
          {BOOKING_STATUSES.map(status => {
            const active = filters.status.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStatus(status)}
                className={cn(
                  'min-h-[44px] rounded-full border px-4 py-1.5 text-sm font-medium transition-colors sm:min-h-0 sm:px-3.5',
                  active
                    ? 'border-ink-900 bg-ink-900 text-ivory-100'
                    : 'border-ink-300 bg-white text-ink-800 hover:border-ink-900',
                )}
              >
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label="Search">
          {control => (
            <DebouncedInput
              {...control}
              type="search"
              placeholder="Customer, email, phone or vehicle"
              value={filters.q}
              onCommit={onSearch}
            />
          )}
        </FormField>
        <FormField label="Showroom">
          {control => (
            <Select
              {...control}
              value={filters.dealershipId}
              onChange={event => onChange({ dealershipId: event.target.value })}
            >
              <option value="">All showrooms</option>
              {(dealerships.data ?? []).map(dealership => (
                <option key={dealership.id} value={dealership.id}>
                  {dealership.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Vehicle">
          {control => (
            <Select
              {...control}
              value={filters.vehicleId}
              onChange={event => onChange({ vehicleId: event.target.value })}
            >
              <option value="">All vehicles</option>
              {(vehicles.data?.items ?? []).map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.manufacturer} {vehicle.model}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Sort by">
          {control => (
            <Select
              {...control}
              value={filters.sort}
              onChange={event => onChange({ sort: event.target.value as AdminSort })}
            >
              {ADMIN_SORTS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Appointment from">
          {control => (
            <Input
              {...control}
              type="date"
              value={filters.dateFrom}
              max={filters.dateTo || undefined}
              onChange={event => onChange({ dateFrom: event.target.value })}
            />
          )}
        </FormField>
        <FormField label="Appointment to">
          {control => (
            <Input
              {...control}
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={event => onChange({ dateTo: event.target.value })}
            />
          )}
        </FormField>
        <div className="flex items-end sm:col-span-2">
          <Button
            variant="ghost"
            disabled={isDefault}
            onClick={() => onChange({ ...DEFAULT_ADMIN_FILTERS, sort: filters.sort })}
          >
            Clear filters
          </Button>
        </div>
      </div>
    </form>
  );
}

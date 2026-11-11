'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Wand2 } from 'lucide-react';
import { ActivationDialog } from '@/components/admin/ActivationDialog';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  DEFAULT_SLOT_FILTERS,
  parseSlotFilters,
  toSlotApiQuery,
  type ActiveFilter,
  type SlotBooked,
  type SlotListFilters,
} from '@/lib/adminLists';
import {
  anchorFrom,
  dayTotals,
  groupSlotsByDay,
  shiftView,
  timeLabel,
  viewRange,
  viewTitle,
  type CalendarView,
} from '@/lib/adminSlots';
import { api } from '@/lib/api';
import { toDateKey } from '@/lib/calendar';
import { cn } from '@/lib/cn';
import { formatDate, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminDealership, AdminSlot, AdminVehicle, Page } from '@/types';
import { EditSlotDialog } from './EditSlotDialog';
import { SlotBooking, SlotStateBadge } from './SlotBits';

const LIST_PAGE_SIZE = 15;
const CALENDAR_PAGE_SIZE = 50;
const CALENDAR_MAX_PAGES = 10;
const OPTIONS_STALE_MS = 5 * 60_000;

const VIEW_TABS = [
  { id: 'list', label: 'List' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

interface ActivationTarget {
  slot: AdminSlot;
  mode: 'activate' | 'deactivate';
}

export function SlotsView() {
  const { filters, change, navigate } = useUrlFilters(parseSlotFilters, DEFAULT_SLOT_FILTERS);
  const [editing, setEditing] = useState<AdminSlot | null>(null);
  const [target, setTarget] = useState<ActivationTarget | null>(null);

  const dealerships = useQuery({
    queryKey: queryKeys.admin.dealerships({ pageSize: 50, purpose: 'options' }),
    queryFn: () => api.get<Page<AdminDealership>>('/api/admin/dealerships', { pageSize: 50 }),
    staleTime: OPTIONS_STALE_MS,
  });
  const vehicles = useQuery({
    queryKey: queryKeys.admin.vehicles({ pageSize: 50, purpose: 'options' }),
    queryFn: () =>
      api.get<Page<AdminVehicle>>('/api/admin/vehicles', {
        pageSize: 50,
        sortBy: 'manufacturer',
        sortOrder: 'asc',
      }),
    staleTime: OPTIONS_STALE_MS,
  });

  const view = filters.view;
  const anchor = anchorFrom(filters.day);
  const range = view === 'list' ? { from: filters.from, to: filters.to } : viewRange(view, anchor);

  const query = toSlotApiQuery(filters, range, {
    page: view === 'list' ? filters.page : 1,
    pageSize: view === 'list' ? LIST_PAGE_SIZE : CALENDAR_PAGE_SIZE,
  });
  const slots = useQuery({
    queryKey: queryKeys.admin.slots({ ...query, view }),
    queryFn: async () => {
      const first = await api.get<Page<AdminSlot>>('/api/admin/slots', query);
      if (view === 'list') return { page: first, items: first.items, truncated: false };
      const items = [...first.items];
      let pageNumber = 1;
      while (pageNumber < first.totalPages && pageNumber < CALENDAR_MAX_PAGES) {
        pageNumber += 1;
        const next = await api.get<Page<AdminSlot>>('/api/admin/slots', {
          ...query,
          page: pageNumber,
        });
        items.push(...next.items);
      }
      return { page: first, items, truncated: first.totalPages > CALENDAR_MAX_PAGES };
    },
    placeholderData: keepPreviousData,
  });

  const openDay = (day: string) => change({ view: 'week', day });
  const hasFilters =
    JSON.stringify({ ...filters, page: 1, view: 'list', day: '' }) !==
    JSON.stringify(DEFAULT_SLOT_FILTERS);

  const onToggle = (slot: AdminSlot) =>
    setTarget({ slot, mode: slot.isActive ? 'deactivate' : 'activate' });

  const columns: Column<AdminSlot>[] = [
    {
      key: 'when',
      header: 'When',
      cell: slot => (
        <div>
          <p className="font-semibold text-ink-900">{formatDate(slot.startAt)}</p>
          <p className="text-xs text-ink-500">
            {formatTime(slot.startAt)} to {formatTime(slot.endAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      cell: slot => `${slot.vehicle.manufacturer} ${slot.vehicle.model}`,
    },
    { key: 'showroom', header: 'Showroom', cell: slot => slot.dealership.name },
    { key: 'state', header: 'Status', cell: slot => <SlotStateBadge slot={slot} /> },
    { key: 'booking', header: 'Booked by', cell: slot => <SlotBooking slot={slot} /> },
    {
      key: 'actions',
      header: 'Actions',
      cell: slot => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(slot)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onToggle(slot)}>
            {slot.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <form
        role="search"
        aria-label="Filter time slots"
        onSubmit={event => event.preventDefault()}
        className="space-y-4 rounded-card border border-ivory-300 bg-white p-4 shadow-soft sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="Showroom">
            {c => (
              <Select
                {...c}
                value={filters.dealershipId}
                onChange={event => change({ dealershipId: event.target.value })}
              >
                <option value="">All showrooms</option>
                {(dealerships.data?.items ?? []).map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Vehicle">
            {c => (
              <Select
                {...c}
                value={filters.vehicleId}
                onChange={event => change({ vehicleId: event.target.value })}
              >
                <option value="">All vehicles</option>
                {(vehicles.data?.items ?? []).map(item => (
                  <option key={item.id} value={item.id}>
                    {item.manufacturer} {item.model}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Booking">
            {c => (
              <Select
                {...c}
                value={filters.booked}
                onChange={event => change({ booked: event.target.value as SlotBooked })}
              >
                <option value="">Booked and free</option>
                <option value="true">Booked only</option>
                <option value="false">Free only</option>
              </Select>
            )}
          </FormField>
          <FormField label="Status">
            {c => (
              <Select
                {...c}
                value={filters.isActive}
                onChange={event => change({ isActive: event.target.value as ActiveFilter })}
              >
                <option value="">Active and inactive</option>
                <option value="true">Active only</option>
                <option value="false">Inactive only</option>
              </Select>
            )}
          </FormField>
          {view === 'list' ? (
            <>
              <FormField label="From">
                {c => (
                  <Input
                    {...c}
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    onChange={event => change({ from: event.target.value })}
                  />
                )}
              </FormField>
              <FormField label="To">
                {c => (
                  <Input
                    {...c}
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    onChange={event => change({ to: event.target.value })}
                  />
                )}
              </FormField>
            </>
          ) : null}
          <div className="flex flex-wrap items-end gap-3 sm:col-span-2 xl:col-span-2 xl:justify-end">
            <Button
              variant="ghost"
              disabled={!hasFilters}
              onClick={() =>
                navigate({ ...DEFAULT_SLOT_FILTERS, view: filters.view, day: filters.day })
              }
            >
              Clear filters
            </Button>
            <ButtonLink href="/admin/slots/bulk" variant="outline">
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              Bulk generator
            </ButtonLink>
            <ButtonLink href="/admin/slots/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add slot
            </ButtonLink>
          </div>
        </div>
      </form>

      <Tabs
        items={VIEW_TABS}
        value={view}
        onChange={id => change({ view: id as SlotListFilters['view'], page: 1 })}
        label="Slot view"
        idPrefix="slot-view"
      />

      {slots.isError && !slots.data ? (
        <ErrorState onRetry={() => void slots.refetch()} />
      ) : view === 'list' ? (
        <>
          <p aria-live="polite" className="text-sm font-medium text-ink-700">
            {slots.data
              ? `${slots.data.page.total} ${slots.data.page.total === 1 ? 'slot' : 'slots'}`
              : 'Loading slots…'}
          </p>
          <div className={slots.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
            <DataTable
              caption="Time slots"
              columns={columns}
              rows={slots.data?.items ?? []}
              rowKey={slot => slot.id}
              loading={slots.isPending}
              empty={
                <EmptyState
                  icon={CalendarClock}
                  title="No time slots match"
                  description={
                    hasFilters
                      ? 'Try widening the date range or clearing a filter.'
                      : 'Create slots one at a time, or generate a whole schedule at once.'
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-3">
                      <ButtonLink href="/admin/slots/new">Add slot</ButtonLink>
                      <ButtonLink href="/admin/slots/bulk" variant="outline">
                        Bulk generator
                      </ButtonLink>
                    </div>
                  }
                />
              }
            />
          </div>
          {slots.data ? (
            <Pagination
              page={slots.data.page.page}
              totalPages={slots.data.page.totalPages}
              onPageChange={page => change({ page })}
            />
          ) : null}
        </>
      ) : (
        <CalendarSection
          view={view}
          anchor={anchor}
          loading={slots.isPending}
          items={slots.data?.items ?? []}
          truncated={slots.data?.truncated ?? false}
          onShift={delta => change({ day: toDateKey(shiftView(view, anchor, delta)) })}
          onToday={() => change({ day: '' })}
          onOpenDay={openDay}
          onEdit={setEditing}
        />
      )}

      <EditSlotDialog slot={editing} onClose={() => setEditing(null)} />
      {target ? (
        <ActivationDialog
          open
          onClose={() => setTarget(null)}
          entity="time slot"
          name={`${format(new Date(target.slot.startAt), 'EEE d MMM, HH:mm')} slot`}
          mode={target.mode}
          warning="Customers will no longer be able to book this time."
          bookingsHref={
            target.slot.activeBooking
              ? `/admin/bookings/${target.slot.activeBooking.id}`
              : '/admin/bookings'
          }
          request={() => api.patch(`/api/admin/slots/${target.slot.id}/${target.mode}`)}
        />
      ) : null}
    </div>
  );
}

interface CalendarSectionProps {
  view: CalendarView;
  anchor: Date;
  loading: boolean;
  items: AdminSlot[];
  truncated: boolean;
  onShift: (delta: number) => void;
  onToday: () => void;
  onOpenDay: (day: string) => void;
  onEdit: (slot: AdminSlot) => void;
}

function CalendarSection({
  view,
  anchor,
  loading,
  items,
  truncated,
  onShift,
  onToday,
  onOpenDay,
  onEdit,
}: CalendarSectionProps) {
  const { days } = useMemo(() => viewRange(view, anchor), [view, anchor]);
  const groups = useMemo(() => groupSlotsByDay(items), [items]);
  const todayKey = toDateKey(new Date());
  const anchorMonth = anchor.getMonth();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
            onClick={() => onShift(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
            onClick={() => onShift(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <h2 aria-live="polite" className="font-display text-2xl font-semibold">
          {viewTitle(view, anchor)}
        </h2>
      </div>
      {truncated ? (
        <p role="note" className="rounded-control bg-ivory-200 px-4 py-2.5 text-sm text-ink-700">
          This period has more slots than can be shown. Filter by showroom or vehicle to see them
          all.
        </p>
      ) : null}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : view === 'week' ? (
        <ol className="grid gap-3 md:grid-cols-7">
          {days.map(day => {
            const key = toDateKey(day);
            const daySlots = groups[key] ?? [];
            return (
              <li
                key={key}
                className={cn(
                  'min-w-0 rounded-card border bg-white p-3',
                  key === todayKey ? 'border-gold-500' : 'border-ivory-300',
                )}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                  {format(day, 'EEE d MMM')}
                </h3>
                {daySlots.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-400">No slots</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {daySlots.map(slot => (
                      <li key={slot.id}>
                        <button
                          type="button"
                          onClick={() => onEdit(slot)}
                          className={cn(
                            'w-full rounded-control border px-2 py-1.5 text-left text-xs transition-colors hover:border-ink-900',
                            slot.activeBooking
                              ? 'border-[#b2c6e6] bg-[#e4ecf8]'
                              : slot.isActive
                                ? 'border-[#a8d6bb] bg-[#e3f4ea]'
                                : 'border-ink-300 bg-ink-100',
                          )}
                        >
                          <span className="block font-semibold text-ink-900">
                            {timeLabel(slot.startAt)} · {slot.vehicle.model}
                          </span>
                          <span className="block truncate text-ink-600">
                            {slot.activeBooking
                              ? `Booked: ${slot.activeBooking.customer.firstName} ${slot.activeBooking.customer.lastName}`
                              : slot.isActive
                                ? 'Free'
                                : 'Inactive'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[40rem] grid-cols-7 gap-px rounded-card border border-ivory-300 bg-ivory-300">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => (
              <div
                key={name}
                className="bg-ivory-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-ink-600"
              >
                {name}
              </div>
            ))}
            {days.map(day => {
              const key = toDateKey(day);
              const daySlots = groups[key] ?? [];
              const totals = dayTotals(daySlots);
              const outside = day.getMonth() !== anchorMonth;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onOpenDay(key)}
                  aria-label={`${format(day, 'EEEE d MMMM')}: ${totals.free} free, ${totals.booked} booked${totals.inactive ? `, ${totals.inactive} inactive` : ''}. Open week`}
                  className={cn(
                    'flex min-h-[5.5rem] flex-col items-start bg-white p-2 text-left transition-colors hover:bg-ivory-100',
                    outside && 'bg-ivory-100/60 text-ink-400',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      key === todayKey && 'rounded-full bg-ink-900 px-1.5 text-ivory-100',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {daySlots.length > 0 ? (
                    <span className="mt-1.5 space-y-0.5 text-[0.7rem] leading-tight">
                      {totals.free > 0 ? (
                        <span className="block text-status-approved">{totals.free} free</span>
                      ) : null}
                      {totals.booked > 0 ? (
                        <span className="block text-status-completed">{totals.booked} booked</span>
                      ) : null}
                      {totals.inactive > 0 ? (
                        <span className="block text-ink-500">{totals.inactive} inactive</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

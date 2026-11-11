'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { fromDateKey } from '@/lib/calendar';
import { cn } from '@/lib/cn';
import { formatDate, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AvailableSlot, VehicleSlots } from '@/types';

const LOOKAHEAD_DAYS = 30;
const DAY_MS = 86_400_000;

interface SlotPickerProps {
  vehicleId: string;
  /** Limit to one showroom; leave empty to offer slots at every showroom. */
  dealershipId?: string;
  selectedSlotId: string | null;
  onSelect: (slot: AvailableSlot | null) => void;
  /** Show which showroom each time belongs to (useful when several are mixed). */
  showDealership?: boolean;
}

/**
 * Month grid of days that have free slots plus the times for the chosen day.
 * Data refreshes whenever the visitor returns to the tab, so a slot taken in the meantime disappears.
 */
export function SlotPicker({
  vehicleId,
  dealershipId = '',
  selectedSlotId,
  onSelect,
  showDealership = false,
}: SlotPickerProps) {
  const [range] = useState(() => {
    const from = new Date();
    return {
      from: from.toISOString(),
      to: new Date(from.getTime() + LOOKAHEAD_DAYS * DAY_MS).toISOString(),
    };
  });
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const params = {
    dealershipId: dealershipId || undefined,
    from: range.from,
    to: range.to,
    timeZone,
  };

  const slots = useQuery({
    queryKey: queryKeys.vehicles.slots(vehicleId, params),
    queryFn: () => api.get<VehicleSlots>(`/api/vehicles/${vehicleId}/slots`, params),
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const dates = useMemo(() => slots.data?.dates ?? [], [slots.data]);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [monthChosen, setMonthChosen] = useState(false);

  useEffect(() => {
    if (!monthChosen && dates.length > 0) setMonth(startOfMonth(fromDateKey(dates[0])));
  }, [dates, monthChosen]);

  const daySlots = dateKey ? (slots.data?.slotsByDate[dateKey] ?? []) : [];

  useEffect(() => {
    if (dateKey && !dates.includes(dateKey)) setDateKey(null);
  }, [dates, dateKey]);

  const openSlotIds = useMemo(
    () =>
      new Set(
        Object.values(slots.data?.slotsByDate ?? {}).flatMap(list => list.map(slot => slot.id)),
      ),
    [slots.data],
  );

  useEffect(() => {
    if (selectedSlotId && slots.data && !openSlotIds.has(selectedSlotId)) onSelect(null);
  }, [slots.data, selectedSlotId, openSlotIds, onSelect]);

  if (slots.isPending) return <Skeleton className="h-72 w-full" />;
  if (slots.isError) {
    return (
      <ErrorState
        title="We could not load the schedule"
        message="Please try again in a moment."
        onRetry={() => void slots.refetch()}
      />
    );
  }
  if (dates.length === 0) {
    return (
      <p className="rounded-control bg-ivory-200 px-4 py-3 text-sm text-ink-700">
        There are no open appointments at this showroom in the coming weeks. Please try another
        showroom.
      </p>
    );
  }

  const first = startOfMonth(fromDateKey(dates[0]));
  const last = startOfMonth(fromDateKey(dates[dates.length - 1]));

  return (
    <div className="space-y-4">
      <DatePicker
        month={month}
        onMonthChange={next => {
          setMonthChosen(true);
          setMonth(next);
        }}
        availableDates={dates}
        value={dateKey}
        onChange={key => {
          setDateKey(key);
          onSelect(null);
        }}
        minMonth={first}
        maxMonth={last}
        className="max-w-none shadow-none"
      />
      {dateKey ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-800">
            Available times on {formatDate(fromDateKey(dateKey))}
          </h3>
          <ul className="grid grid-cols-2 gap-2">
            {daySlots.map(slot => {
              const selected = slot.id === selectedSlotId;
              return (
                <li key={slot.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(slot)}
                    className={cn(
                      'w-full rounded-control border px-3 py-2.5 text-sm font-medium transition-colors',
                      selected
                        ? 'border-ink-900 bg-ink-900 text-ivory-100'
                        : 'border-ink-300 bg-white text-ink-900 hover:border-gold-600',
                    )}
                  >
                    {formatTime(slot.startAt)} – {formatTime(slot.endAt)}
                    {showDealership ? (
                      <span className="block text-xs font-normal opacity-80">
                        {slot.dealership.name}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-600">
          Choose a highlighted date to see the available times.
        </p>
      )}
    </div>
  );
}

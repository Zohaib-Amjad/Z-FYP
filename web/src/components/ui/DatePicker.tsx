'use client';

import { useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { monthGrid, shiftMonth, toDateKey } from '@/lib/calendar';

interface DatePickerProps {
  /** First day of the month being shown. */
  month: Date;
  onMonthChange: (month: Date) => void;
  /** yyyy-MM-dd keys that have slots; every other day is disabled. */
  availableDates: readonly string[];
  /** Selected yyyy-MM-dd key. */
  value: string | null;
  onChange: (dateKey: string) => void;
  /** Earliest and latest month the user may navigate to. */
  minMonth?: Date;
  maxMonth?: Date;
  className?: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month grid that only lets people pick days which actually have test-drive slots. */
export function DatePicker({
  month,
  onMonthChange,
  availableDates,
  value,
  onChange,
  minMonth,
  maxMonth,
  className,
}: DatePickerProps) {
  const available = useMemo(() => new Set(availableDates), [availableDates]);
  const cells = useMemo(() => monthGrid(month), [month]);
  const canGoBack = !minMonth || month > startOfMonth(minMonth);
  const canGoForward = !maxMonth || month < startOfMonth(maxMonth);
  const heading = format(month, 'MMMM yyyy');

  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-card border border-ivory-300 bg-white p-4 shadow-soft',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="rounded-control p-2 text-ink-700 hover:bg-ink-100 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h3 aria-live="polite" className="font-display text-lg font-semibold">
          {heading}
        </h3>
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          disabled={!canGoForward}
          aria-label="Next month"
          className="rounded-control p-2 text-ink-700 hover:bg-ink-100 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={heading}>
        {WEEKDAYS.map(day => (
          <span
            key={day}
            aria-hidden="true"
            className="py-1 text-xs font-semibold uppercase text-ink-500"
          >
            {day}
          </span>
        ))}
        {cells.map(cell => {
          const key = toDateKey(cell.date);
          const isAvailable = cell.inMonth && available.has(key);
          const selected = key === value;
          return (
            <button
              key={cell.key}
              type="button"
              disabled={!isAvailable}
              aria-pressed={selected}
              aria-label={`${format(cell.date, 'EEEE d MMMM yyyy')}${isAvailable ? ', slots available' : ', no slots'}`}
              onClick={() => onChange(key)}
              className={cn(
                'relative flex h-10 items-center justify-center rounded-control text-sm transition-colors',
                !cell.inMonth && 'invisible',
                isAvailable && !selected && 'font-semibold text-ink-900 hover:bg-gold-200/60',
                isAvailable &&
                  !selected &&
                  'after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-gold-600',
                selected && 'bg-ink-900 font-semibold text-ivory-100',
                !isAvailable && 'cursor-not-allowed text-ink-300',
              )}
            >
              {format(cell.date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

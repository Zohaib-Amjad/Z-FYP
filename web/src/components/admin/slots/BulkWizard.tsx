'use client';

import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { FormAlert } from '@/components/auth/FormAlert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import {
  WEEKDAY_OPTIONS,
  bulkSchema,
  toBulkPayload,
  type BulkFormValues,
} from '@/lib/adminSchemas';
import { api, ApiError } from '@/lib/api';
import { describeSlotProblem } from '@/lib/booking';
import { groupSlotsByDay } from '@/lib/adminSlots';
import { cn } from '@/lib/cn';
import { formatDate, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { BulkSlotResult } from '@/types';
import { useSlotOptions } from './useSlotOptions';

const PREVIEW_DELAY_MS = 600;
const SKIP_LABELS = {
  IN_PAST: 'Already in the past',
  OVERLAPS_EXISTING: 'Overlaps an existing slot',
} as const;

const DEFAULTS: BulkFormValues = {
  dealershipId: '',
  vehicleId: '',
  dateFrom: '',
  dateTo: '',
  daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  dailyStartTime: '09:00',
  dailyEndTime: '17:00',
  durationMinutes: '60',
  breakMinutes: '0',
};

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: BulkSlotResult };

export function BulkWizard() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const options = useSlotOptions();
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });
  const [problem, setProblem] = useState<string | null>(null);

  const { form, submit, formError } = useApiForm({
    schema: bulkSchema,
    defaultValues: DEFAULTS,
    onError: error => {
      const text = describeSlotProblem(error);
      setProblem(text);
      return text !== null;
    },
    onSubmit: async values => {
      setProblem(null);
      const result = await api.post<BulkSlotResult>(
        '/api/admin/slots/bulk',
        toBulkPayload(values, timeZone),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      toast.success(
        `${result.totals.slots} time ${result.totals.slots === 1 ? 'slot' : 'slots'} created.`,
      );
      router.push('/admin/slots');
    },
  });
  const {
    register,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const values = watch();
  const serialised = JSON.stringify(values);

  useEffect(() => {
    const parsed = bulkSchema.safeParse(JSON.parse(serialised));
    if (!parsed.success) {
      setPreview({ status: 'idle' });
      return undefined;
    }
    setPreview({ status: 'loading' });
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.post<BulkSlotResult>(
          '/api/admin/slots/bulk?dryRun=true',
          toBulkPayload(parsed.data, timeZone),
        );
        if (!cancelled) setPreview({ status: 'ready', result });
      } catch (error) {
        if (!cancelled) {
          setPreview({
            status: 'error',
            message:
              error instanceof ApiError ? error.message : 'The preview could not be generated.',
          });
        }
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [serialised, timeZone]);

  const ready = preview.status === 'ready' ? preview.result : null;
  const groups = ready ? groupSlotsByDay(ready.slots) : {};

  return (
    <div className="grid gap-8 xl:grid-cols-[2fr_3fr] xl:items-start">
      <Card>
        <form method="post" onSubmit={submit} noValidate>
          <CardHeader>
            <h2 className="font-display text-2xl font-semibold">Schedule</h2>
            <p className="mt-1 text-sm text-ink-600">
              Slots are generated in your time zone ({timeZone}). The preview updates as you type.
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <FormAlert message={problem ?? formError} />
            <FormField label="Showroom" error={errors.dealershipId?.message} required>
              {c => (
                <Select {...c} disabled={options.loading} {...register('dealershipId')}>
                  <option value="">Select a showroom</option>
                  {options.dealerships.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}, {item.city}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Vehicle" error={errors.vehicleId?.message} required>
              {c => (
                <Select {...c} disabled={options.loading} {...register('vehicleId')}>
                  <option value="">Select a vehicle</option>
                  {options.vehicles.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.manufacturer} {item.model}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="From date" error={errors.dateFrom?.message} required>
                {c => <Input {...c} type="date" {...register('dateFrom')} />}
              </FormField>
              <FormField label="To date" error={errors.dateTo?.message} required>
                {c => <Input {...c} type="date" {...register('dateTo')} />}
              </FormField>
            </div>
            <Controller
              control={control}
              name="daysOfWeek"
              render={({ field }) => (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-ink-800">
                    Days of the week
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map(day => {
                      const active = field.value.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            field.onChange(
                              active
                                ? field.value.filter(item => item !== day.value)
                                : [...field.value, day.value],
                            )
                          }
                          className={cn(
                            'min-h-[44px] rounded-full border px-4 py-1.5 text-sm font-medium transition-colors sm:min-h-0 sm:px-3.5',
                            active
                              ? 'border-ink-900 bg-ink-900 text-ivory-100'
                              : 'border-ink-300 bg-white text-ink-800 hover:border-ink-900',
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  {errors.daysOfWeek?.message ? (
                    <p role="alert" className="mt-1.5 text-xs font-medium text-status-rejected">
                      {errors.daysOfWeek.message}
                    </p>
                  ) : null}
                </fieldset>
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Daily start" error={errors.dailyStartTime?.message} required>
                {c => <Input {...c} type="time" {...register('dailyStartTime')} />}
              </FormField>
              <FormField label="Daily end" error={errors.dailyEndTime?.message} required>
                {c => <Input {...c} type="time" {...register('dailyEndTime')} />}
              </FormField>
              <FormField
                label="Slot length (minutes)"
                error={errors.durationMinutes?.message}
                required
              >
                {c => <Input {...c} inputMode="numeric" {...register('durationMinutes')} />}
              </FormField>
              <FormField label="Break between slots (minutes)" error={errors.breakMinutes?.message}>
                {c => <Input {...c} inputMode="numeric" {...register('breakMinutes')} />}
              </FormField>
            </div>
          </CardBody>
        </form>
      </Card>

      <Card className="xl:sticky xl:top-24">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">Preview</h2>
          <p aria-live="polite" className="mt-1 text-sm text-ink-600">
            {preview.status === 'idle' &&
              'Complete the schedule to see which slots will be created.'}
            {preview.status === 'loading' && 'Checking the schedule…'}
            {preview.status === 'error' && 'The schedule cannot be created yet.'}
            {ready &&
              `${ready.totals.slots} to create${ready.totals.skipped > 0 ? `, ${ready.totals.skipped} skipped` : ''} (${ready.totals.candidates} candidates).`}
          </p>
        </CardHeader>
        <CardBody className="space-y-6">
          {preview.status === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
          {preview.status === 'error' ? (
            <p
              role="alert"
              className="rounded-control border border-status-rejected/30 bg-[#fdf6f6] px-4 py-3 text-sm text-status-rejected"
            >
              {preview.message}
            </p>
          ) : null}
          {ready ? (
            <>
              {ready.slots.length === 0 ? (
                <p className="text-sm text-ink-600">
                  No new slots would be created with these settings.
                </p>
              ) : (
                <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
                  {Object.entries(groups).map(([day, slots]) => (
                    <section key={day} aria-label={formatDate(slots[0].startAt)}>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                        {formatDate(slots[0].startAt)}
                      </h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {slots.map(slot => (
                          <li
                            key={slot.startAt}
                            className="rounded-control bg-[#e3f4ea] px-2.5 py-1 text-xs font-medium text-status-approved"
                          >
                            {formatTime(slot.startAt)} – {formatTime(slot.endAt)}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              {ready.skipped.length > 0 ? (
                <section aria-label="Skipped slots">
                  <h3 className="text-sm font-semibold text-ink-900">
                    Skipped ({ready.skipped.length})
                  </h3>
                  <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs text-ink-700">
                    {ready.skipped.map(item => (
                      <li
                        key={item.startAt}
                        className="flex flex-wrap justify-between gap-2 rounded-control bg-ivory-200 px-2.5 py-1.5"
                      >
                        <span>{format(new Date(item.startAt), 'EEE d MMM, HH:mm')}</span>
                        <span className="text-ink-600">{SKIP_LABELS[item.reason]}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3 border-t border-ivory-300 pt-5">
            <ButtonLink href="/admin/slots" variant="ghost">
              Cancel
            </ButtonLink>
            <Button
              onClick={() => void submit()}
              loading={isSubmitting}
              disabled={!ready || ready.slots.length === 0}
            >
              {ready && ready.slots.length > 0
                ? `Create ${ready.slots.length} ${ready.slots.length === 1 ? 'slot' : 'slots'}`
                : 'Create slots'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminDealership, Page, VehicleDealershipLink } from '@/types';

type Selection = Record<string, { offered: boolean; available: boolean }>;

const fromLinks = (links: VehicleDealershipLink[]): Selection =>
  Object.fromEntries(links.map(link => [link.id, { offered: true, available: link.isAvailable }]));

const same = (a: Selection, b: Selection): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(
    key =>
      Boolean(a[key]?.offered) === Boolean(b[key]?.offered) &&
      (!a[key]?.offered || a[key].available === b[key]?.available),
  );
};

interface DealershipLinksProps {
  vehicleId: string;
  links: VehicleDealershipLink[];
}

export function DealershipLinks({ vehicleId, links }: DealershipLinksProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const saved = useMemo(() => fromLinks(links), [links]);
  const [selection, setSelection] = useState<Selection>(saved);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const params = { pageSize: 50, sortBy: 'name' };
  const dealerships = useQuery({
    queryKey: queryKeys.admin.dealerships(params),
    queryFn: () => api.get<Page<AdminDealership>>('/api/admin/dealerships', params),
  });

  const dirty = !same(selection, saved);
  useUnsavedChangesGuard(dirty);

  const set = (id: string, change: Partial<Selection[string]>) =>
    setSelection(current => ({
      ...current,
      [id]: { ...{ offered: false, available: true }, ...current[id], ...change },
    }));

  const save = async () => {
    setSaving(true);
    setProblem(null);
    try {
      const payload = Object.entries(selection)
        .filter(([, value]) => value.offered)
        .map(([dealershipId, value]) => ({ dealershipId, isAvailable: value.available }));
      await api.put(`/api/admin/vehicles/${vehicleId}/dealerships`, { dealerships: payload });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      toast.success('Showroom availability saved.');
    } catch (error) {
      setProblem(
        error instanceof ApiError
          ? error.message
          : 'We could not save these changes. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-semibold">Showrooms offering this vehicle</h2>
        <p className="mt-1 text-sm text-ink-600">
          Choose where the vehicle is shown, and switch off test drives at a showroom without
          removing it.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {dealerships.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : dealerships.isError ? (
          <ErrorState onRetry={() => void dealerships.refetch()} />
        ) : (
          <ul className="divide-y divide-ivory-300 rounded-card border border-ivory-300">
            {dealerships.data.items.map(dealership => {
              const value = selection[dealership.id] ?? { offered: false, available: true };
              return (
                <li
                  key={dealership.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={value.offered}
                      onChange={event => set(dealership.id, { offered: event.target.checked })}
                      className="mt-1 h-5 w-5 accent-gold-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink-900">
                        {dealership.name}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {dealership.city}
                        {dealership.isActive ? '' : ' · Inactive showroom'}
                      </span>
                    </span>
                  </label>
                  <label
                    className={`flex items-center gap-2.5 text-sm ${value.offered ? 'text-ink-800' : 'text-ink-400'}`}
                  >
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={value.available}
                      checked={value.available}
                      disabled={!value.offered}
                      onChange={event => set(dealership.id, { available: event.target.checked })}
                      className="h-5 w-5 accent-gold-600"
                    />
                    Available for test drives
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {problem ? (
          <div
            role="alert"
            className="rounded-control border border-status-rejected/30 bg-[#fdf6f6] px-4 py-3 text-sm text-status-rejected"
          >
            <p>{problem}</p>
            <Link
              href={`/admin/bookings?vehicleId=${vehicleId}&status=PENDING,APPROVED,RESCHEDULED&sort=slotStartAsc`}
              className="mt-1 inline-block font-semibold underline-offset-4 hover:underline"
            >
              View this vehicle&rsquo;s upcoming bookings
            </Link>
          </div>
        ) : null}
      </CardBody>
      <CardFooter className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => setSelection(saved)} disabled={!dirty || saving}>
          Discard changes
        </Button>
        <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
          {saving ? 'Saving…' : 'Save showrooms'}
        </Button>
      </CardFooter>
    </Card>
  );
}

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { VehicleCard } from '@/components/vehicles/VehicleCard';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import {
  CATALOG_PAGE_SIZE,
  SORT_OPTIONS,
  activeChips,
  applyChange,
  clearAll,
  parseFilters,
  removeChip,
  toApiQuery,
  toSearchParams,
  type CatalogFilters,
  type CatalogSort,
} from '@/lib/catalog';
import { queryKeys } from '@/lib/queryKeys';
import type { Page, VehicleFilters, VehicleListItem } from '@/types';
import { DebouncedInput } from './DebouncedInput';
import { FilterPanel } from './FilterPanel';

const OPTIONS_STALE_MS = 5 * 60_000;

function CardSkeleton() {
  return (
    <li
      aria-hidden="true"
      className="overflow-hidden rounded-card border border-ivory-300 bg-white"
    >
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </div>
    </li>
  );
}

export function CatalogBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const results = useRef<HTMLDivElement>(null);

  const navigate = useCallback(
    (next: CatalogFilters, mode: 'push' | 'replace') => {
      const query = toSearchParams(next).toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (mode === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router],
  );

  const update = useCallback(
    (change: Partial<CatalogFilters>, mode: 'push' | 'replace' = 'push') =>
      navigate(applyChange(filters, change), mode),
    [filters, navigate],
  );

  const commitSearch = useCallback((q: string) => update({ q }, 'replace'), [update]);

  const options = useQuery({
    queryKey: queryKeys.vehicles.filters(),
    queryFn: () => api.get<VehicleFilters>('/api/vehicles/filters'),
    staleTime: OPTIONS_STALE_MS,
  });

  const apiQuery = toApiQuery(filters);
  const list = useQuery({
    queryKey: queryKeys.vehicles.list(apiQuery),
    queryFn: () => api.get<Page<VehicleListItem>>('/api/vehicles', apiQuery),
    placeholderData: keepPreviousData,
  });

  const chips = activeChips(filters);
  const page = list.data;
  const showSkeleton = list.isPending;

  const goToPage = (next: number) => {
    update({ page: next });
    results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const panel = (
    <FilterPanel filters={filters} options={options.data} onChange={change => update(change)} />
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24 rounded-card border border-ivory-300 bg-white p-5 shadow-soft">
          <h2 className="mb-5 font-display text-2xl font-semibold">Refine</h2>
          {panel}
        </div>
      </aside>

      <div ref={results} className="min-w-0 scroll-mt-24">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <label htmlFor="catalog-search" className="sr-only">
              Search vehicles
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
              aria-hidden="true"
            />
            <DebouncedInput
              id="catalog-search"
              type="search"
              placeholder="Search by manufacturer, model or keyword"
              className="pl-10"
              value={filters.q}
              onCommit={commitSearch}
            />
          </div>
          <Button variant="outline" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters{chips.length > 0 ? ` (${chips.length})` : ''}
          </Button>
          <div className="w-full sm:w-56">
            <label htmlFor="catalog-sort" className="sr-only">
              Sort by
            </label>
            <Select
              id="catalog-sort"
              value={filters.sort}
              onChange={event => update({ sort: event.target.value as CatalogSort })}
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <p aria-live="polite" className="mr-2 text-sm font-medium text-ink-700">
            {page
              ? `${page.total} ${page.total === 1 ? 'vehicle' : 'vehicles'}`
              : 'Loading vehicles…'}
          </p>
          {chips.map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={() => navigate(removeChip(filters, chip.key), 'push')}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-300 bg-white px-3.5 py-1 text-xs font-medium sm:min-h-0 text-ink-800 hover:border-ink-900"
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          {chips.length > 0 ? (
            <button
              type="button"
              onClick={() => navigate(clearAll(filters), 'push')}
              className="text-xs font-semibold text-gold-700 underline-offset-4 hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        <div className="mt-6">
          {list.isError && !page ? (
            <ErrorState
              title="We could not load the collection"
              message="Please check your connection and try again."
              onRetry={() => void list.refetch()}
            />
          ) : showSkeleton ? (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => (
                <CardSkeleton key={index} />
              ))}
            </ul>
          ) : page && page.items.length === 0 ? (
            <EmptyState
              title="No vehicles match your search"
              description="Try removing a filter or widening your price and year range."
              action={
                <Button onClick={() => navigate(clearAll(filters), 'push')}>
                  Reset all filters
                </Button>
              }
            />
          ) : page ? (
            <>
              <ul
                className={`grid gap-6 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${list.isPlaceholderData ? 'opacity-60' : ''}`}
              >
                {page.items.map((vehicle, index) => (
                  <li key={vehicle.id}>
                    <VehicleCard
                      vehicle={vehicle}
                      showNextSlot
                      headingLevel={2}
                      priority={index < 3}
                    />
                  </li>
                ))}
              </ul>
              <Pagination
                className="mt-10"
                page={page.page}
                totalPages={Math.ceil(page.total / CATALOG_PAGE_SIZE)}
                onPageChange={goToPage}
              />
            </>
          ) : null}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(clearAll(filters), 'push')}
              disabled={chips.length === 0}
            >
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setDrawerOpen(false)}>
              {page
                ? `Show ${page.total} ${page.total === 1 ? 'vehicle' : 'vehicles'}`
                : 'Show results'}
            </Button>
          </div>
        }
      >
        {panel}
      </Drawer>
    </div>
  );
}

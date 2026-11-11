'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { applyListChange, toParams } from '@/lib/adminLists';

type Mode = 'push' | 'replace';

/**
 * Filters that live in the URL, so a view is shareable and the back button works.
 * `change` merges a partial update (back to page 1 unless the page changes).
 */
export function useUrlFilters<T extends { page: number }>(
  parse: (params: URLSearchParams) => T,
  defaults: T,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parse(searchParams), [parse, searchParams]);

  const navigate = useCallback(
    (next: T, mode: Mode = 'push') => {
      const query = toParams(next, defaults).toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (mode === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [defaults, pathname, router],
  );

  const change = useCallback(
    (partial: Partial<T>, mode: Mode = 'push') => navigate(applyListChange(filters, partial), mode),
    [filters, navigate],
  );

  return { filters, change, navigate };
}

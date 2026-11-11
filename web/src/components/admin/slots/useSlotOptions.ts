'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminDealership, AdminVehicle, Page } from '@/types';

const STALE_MS = 5 * 60_000;

/** Active showrooms and vehicles for the slot forms' selects. */
export function useSlotOptions() {
  const dealerships = useQuery({
    queryKey: queryKeys.admin.dealerships({ pageSize: 50, isActive: 'true', purpose: 'options' }),
    queryFn: () =>
      api.get<Page<AdminDealership>>('/api/admin/dealerships', { pageSize: 50, isActive: true }),
    staleTime: STALE_MS,
  });
  const vehicles = useQuery({
    queryKey: queryKeys.admin.vehicles({ pageSize: 50, isActive: 'true', purpose: 'options' }),
    queryFn: () =>
      api.get<Page<AdminVehicle>>('/api/admin/vehicles', {
        pageSize: 50,
        isActive: true,
        sortBy: 'manufacturer',
        sortOrder: 'asc',
      }),
    staleTime: STALE_MS,
  });
  return {
    dealerships: dealerships.data?.items ?? [],
    vehicles: vehicles.data?.items ?? [],
    loading: dealerships.isPending || vehicles.isPending,
  };
}

import type { MetadataRoute } from 'next';
import { fetchPublic } from '@/lib/serverApi';
import type { Page, VehicleListItem } from '@/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const PAGE_SIZE = 50;
const MAX_PAGES = 10;

/** Public pages plus one entry per active vehicle. Private and admin pages are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vehicles: VehicleListItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await fetchPublic<Page<VehicleListItem>>(
      `/api/vehicles?pageSize=${PAGE_SIZE}&page=${page}`,
    );
    if (!result) break;
    vehicles.push(...result.items);
    if (page >= result.totalPages) break;
  }

  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/vehicles`, changeFrequency: 'daily', priority: 0.9 },
    ...vehicles.map(vehicle => ({
      url: `${SITE_URL}/vehicles/${vehicle.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/login`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/register`, changeFrequency: 'yearly', priority: 0.4 },
  ];
}

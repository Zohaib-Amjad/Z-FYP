import type { Crumb } from '@/components/ui/Breadcrumbs';

const SEGMENT_LABELS: Record<string, string> = {
  bookings: 'Bookings',
  vehicles: 'Vehicles',
  dealerships: 'Dealerships',
  slots: 'Time slots',
  customers: 'Customers',
  staff: 'Staff',
  profile: 'My profile',
  new: 'New',
  edit: 'Edit',
};

const ID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Breadcrumb trail for an /admin path, e.g. Dashboard / Bookings / Details. */
export function adminCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split(/[?#]/)[0].split('/').filter(Boolean).slice(1);
  const crumbs: Crumb[] = [{ label: 'Dashboard', href: '/admin' }];
  let href = '/admin';
  segments.forEach(segment => {
    href += `/${segment}`;
    crumbs.push({
      label: ID_LIKE.test(segment) ? 'Details' : (SEGMENT_LABELS[segment] ?? segment),
      href,
    });
  });
  const last = crumbs[crumbs.length - 1];
  crumbs[crumbs.length - 1] = { label: last.label };
  return crumbs;
}

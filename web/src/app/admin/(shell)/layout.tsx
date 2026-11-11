import { ForbiddenPage } from '@/components/layout/ForbiddenPage';
import { AdminShell } from '@/components/layout/AdminShell';
import { requireSession } from '@/lib/session';

export const metadata = { robots: { index: false, follow: false } };

/** Everything under /admin except /admin/login: STAFF only, wrapped in the sidebar shell. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireSession('STAFF');
  if (check.status === 'forbidden') return <ForbiddenPage role={check.user.role} />;
  return <AdminShell>{children}</AdminShell>;
}

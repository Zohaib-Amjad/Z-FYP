import { ForbiddenPage } from '@/components/layout/ForbiddenPage';
import { requireSession } from '@/lib/session';

export const metadata = { robots: { index: false, follow: false } };

/**
 * Guards the signed-in customer pages (/account, /my-bookings, /notifications, /book).
 * Signed-out visitors are redirected to /login; staff get the friendly 403 page.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const check = await requireSession();
  if (check.status === 'forbidden') return <ForbiddenPage role={check.user.role} />;
  return <>{children}</>;
}

import { Suspense } from 'react';
import { NotificationsList } from '@/components/notifications/NotificationsList';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata = { title: 'Notifications' };

export default function NotificationsPage() {
  return (
    <main id="main-content" className="container-page max-w-3xl py-12">
      <PageHeader
        eyebrow="My account"
        title="Notifications"
        description="Every update about your test-drive requests, in one place."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <NotificationsList />
      </Suspense>
    </main>
  );
}

import { DashboardView } from '@/components/admin/dashboard/DashboardView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = { title: 'Dashboard' };

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Dashboard"
        description="Bookings, showrooms and the vehicle collection at a glance."
      />
      <DashboardView />
    </>
  );
}

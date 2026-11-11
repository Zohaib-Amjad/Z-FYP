import { StaffView } from '@/components/admin/staff/StaffView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = { title: 'Staff' };

export default function AdminStaffPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Staff"
        description="Showroom staff with access to this portal."
      />
      <StaffView />
    </>
  );
}

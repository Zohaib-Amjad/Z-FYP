import { BulkWizard } from '@/components/admin/slots/BulkWizard';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = { title: 'Bulk slot generator' };

export default function BulkSlotsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Time slots"
        title="Bulk slot generator"
        description="Generate a schedule across a date range. Review the preview, then create."
      />
      <BulkWizard />
    </>
  );
}

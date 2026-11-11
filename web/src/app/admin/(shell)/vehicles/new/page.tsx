import { VehicleForm } from '@/components/admin/vehicles/VehicleForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = { title: 'Add vehicle' };

export default function NewVehiclePage() {
  return (
    <>
      <PageHeader
        eyebrow="Vehicles"
        title="Add a vehicle"
        description="Enter the details first; photographs and showrooms are added on the next screen."
      />
      <VehicleForm />
    </>
  );
}

import { VehicleEditor } from '@/components/admin/vehicles/VehicleEditor';

export const metadata = { title: 'Edit vehicle' };

export default function EditVehiclePage({ params }: { params: { id: string } }) {
  return <VehicleEditor vehicleId={params.id} />;
}

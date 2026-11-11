'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller } from 'react-hook-form';
import { FormAlert } from '@/components/auth/FormAlert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TagInput } from '@/components/ui/TagInput';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useApiForm } from '@/hooks/useApiForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import {
  MAX_FEATURES,
  MAX_FEATURE_LENGTH,
  toVehiclePayload,
  vehicleSchema,
  type VehicleFormValues,
} from '@/lib/adminSchemas';
import { api } from '@/lib/api';
import { enumLabel } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import {
  FUEL_TYPES,
  TRANSMISSIONS,
  VEHICLE_TYPES,
  type AdminVehicle,
  type AdminVehicleDetail,
} from '@/types';

const EMPTY: VehicleFormValues = {
  manufacturer: '',
  model: '',
  year: String(new Date().getFullYear()),
  vehicleType: 'SEDAN',
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  engine: '',
  powerHp: '',
  topSpeedKmh: '',
  acceleration0to100: '',
  seats: '',
  color: '',
  priceFrom: '',
  description: '',
  features: [],
  availabilityNote: '',
};

const str = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

function valuesFor(vehicle: AdminVehicleDetail | undefined): VehicleFormValues {
  if (!vehicle) return EMPTY;
  return {
    manufacturer: vehicle.manufacturer,
    model: vehicle.model,
    year: str(vehicle.year),
    vehicleType: vehicle.vehicleType as VehicleFormValues['vehicleType'],
    fuelType: vehicle.fuelType as VehicleFormValues['fuelType'],
    transmission: vehicle.transmission as VehicleFormValues['transmission'],
    engine: vehicle.engine ?? '',
    powerHp: str(vehicle.powerHp),
    topSpeedKmh: str(vehicle.topSpeedKmh),
    acceleration0to100: str(vehicle.acceleration0to100),
    seats: str(vehicle.seats),
    color: vehicle.color ?? '',
    priceFrom: str(vehicle.priceFrom),
    description: vehicle.description ?? '',
    features: vehicle.features,
    availabilityNote: vehicle.availabilityNote ?? '',
  };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        {description ? <p className="text-sm text-ink-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function VehicleForm({ vehicle }: { vehicle?: AdminVehicleDetail }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const defaults = valuesFor(vehicle);

  const { form, submit, formError } = useApiForm({
    schema: vehicleSchema,
    defaultValues: defaults,
    onSubmit: async values => {
      const payload = toVehiclePayload(values);
      if (vehicle) {
        await api.patch<AdminVehicle>(`/api/admin/vehicles/${vehicle.id}`, payload);
        await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
        form.reset(values);
        toast.success('Vehicle details saved.');
      } else {
        const created = await api.post<AdminVehicle>('/api/admin/vehicles', payload);
        await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
        form.reset(values);
        toast.success('Vehicle added. You can now upload photographs and assign showrooms.');
        router.push(`/admin/vehicles/${created.id}`);
      }
    },
  });
  const {
    register,
    control,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  useUnsavedChangesGuard(isDirty && !isSubmitting);
  const descriptionLength = watch('description').length;

  return (
    <Card>
      <form method="post" onSubmit={submit} noValidate>
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold">
            {vehicle ? 'Vehicle details' : 'New vehicle'}
          </h2>
        </CardHeader>
        <CardBody className="space-y-10">
          <FormAlert message={formError} />

          <Section title="Basics">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Manufacturer" error={errors.manufacturer?.message} required>
                {c => <Input {...c} {...register('manufacturer')} />}
              </FormField>
              <FormField label="Model" error={errors.model?.message} required>
                {c => <Input {...c} {...register('model')} />}
              </FormField>
              <FormField label="Model year" error={errors.year?.message} required>
                {c => <Input {...c} inputMode="numeric" {...register('year')} />}
              </FormField>
              <FormField label="Colour" error={errors.color?.message} required>
                {c => <Input {...c} {...register('color')} />}
              </FormField>
              <FormField label="Vehicle type" error={errors.vehicleType?.message} required>
                {c => (
                  <Select {...c} {...register('vehicleType')}>
                    {VEHICLE_TYPES.map(type => (
                      <option key={type} value={type}>
                        {enumLabel(type)}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Fuel type" error={errors.fuelType?.message} required>
                {c => (
                  <Select {...c} {...register('fuelType')}>
                    {FUEL_TYPES.map(fuel => (
                      <option key={fuel} value={fuel}>
                        {enumLabel(fuel)}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Transmission" error={errors.transmission?.message} required>
                {c => (
                  <Select {...c} {...register('transmission')}>
                    {TRANSMISSIONS.map(item => (
                      <option key={item} value={item}>
                        {enumLabel(item)}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField
                label="Starting price (£)"
                hint="Leave blank to show “Price on request”."
                error={errors.priceFrom?.message}
              >
                {c => <Input {...c} inputMode="decimal" {...register('priceFrom')} />}
              </FormField>
            </div>
          </Section>

          <Section title="Specifications">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label="Engine"
                error={errors.engine?.message}
                required
                className="sm:col-span-2"
              >
                {c => (
                  <Input {...c} placeholder="e.g. 4.0L twin-turbo V8" {...register('engine')} />
                )}
              </FormField>
              <FormField label="Power (hp)" error={errors.powerHp?.message} required>
                {c => <Input {...c} inputMode="numeric" {...register('powerHp')} />}
              </FormField>
              <FormField label="Seats" error={errors.seats?.message} required>
                {c => <Input {...c} inputMode="numeric" {...register('seats')} />}
              </FormField>
              <FormField label="Top speed (km/h)" error={errors.topSpeedKmh?.message}>
                {c => <Input {...c} inputMode="numeric" {...register('topSpeedKmh')} />}
              </FormField>
              <FormField label="0 to 100 km/h (seconds)" error={errors.acceleration0to100?.message}>
                {c => <Input {...c} inputMode="decimal" {...register('acceleration0to100')} />}
              </FormField>
            </div>
          </Section>

          <Section
            title="Features"
            description={`Up to ${MAX_FEATURES} highlights, each at most ${MAX_FEATURE_LENGTH} characters.`}
          >
            <FormField
              label="Features"
              hint="Press Enter or comma after each feature."
              error={errors.features?.message ?? errors.features?.root?.message}
            >
              {c => (
                <Controller
                  control={control}
                  name="features"
                  render={({ field }) => (
                    <TagInput
                      id={c.id}
                      aria-describedby={c['aria-describedby']}
                      aria-invalid={c['aria-invalid']}
                      value={field.value}
                      onChange={field.onChange}
                      max={MAX_FEATURES}
                      maxLength={MAX_FEATURE_LENGTH}
                    />
                  )}
                />
              )}
            </FormField>
          </Section>

          <Section title="Description">
            <FormField
              label="Description"
              hint={`${descriptionLength} of 5000 characters`}
              error={errors.description?.message}
              required
            >
              {c => <Textarea {...c} rows={6} {...register('description')} />}
            </FormField>
            <FormField
              label="Availability note"
              hint="Optional. Shown to customers, e.g. “Available by appointment”."
              error={errors.availabilityNote?.message}
            >
              {c => <Input {...c} {...register('availabilityNote')} />}
            </FormField>
          </Section>
        </CardBody>
        <CardFooter className="flex flex-wrap items-center justify-end gap-3">
          {vehicle ? (
            <Button
              variant="ghost"
              onClick={() => form.reset(defaults)}
              disabled={!isDirty || isSubmitting}
            >
              Discard changes
            </Button>
          ) : (
            <ButtonLink href="/admin/vehicles" variant="ghost">
              Cancel
            </ButtonLink>
          )}
          <Button type="submit" loading={isSubmitting} disabled={Boolean(vehicle) && !isDirty}>
            {isSubmitting ? 'Saving…' : vehicle ? 'Save changes' : 'Add vehicle'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Car, Clock, Info, MapPin, Phone } from 'lucide-react';
import { FormAlert } from '@/components/auth/FormAlert';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { useApiForm } from '@/hooks/useApiForm';
import { api, ApiError } from '@/lib/api';
import { describeBookingProblem, type BookingProblem } from '@/lib/booking';
import { formatDate, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { MAX_NOTE_LENGTH, bookingConfirmSchema } from '@/lib/schemas';
import type { Booking, SlotPreview, User } from '@/types';
import { BookingProblemAlert } from './BookingProblemAlert';
import { BookingSuccess } from './BookingSuccess';

function durationLabel(preview: SlotPreview): string {
  const minutes = Math.round(
    (new Date(preview.endAt).getTime() - new Date(preview.startAt).getTime()) / 60_000,
  );
  return minutes % 60 === 0
    ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}`
    : `${minutes} minutes`;
}

function Summary({ preview }: { preview: SlotPreview }) {
  const { vehicle, dealership } = preview;
  const title = `${vehicle.manufacturer} ${vehicle.model}`;
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[16/9] bg-ink-900">
        {vehicle.primaryImage ? (
          <Image
            src={vehicle.primaryImage.url}
            alt={vehicle.primaryImage.altText ?? title}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            unoptimized={vehicle.primaryImage.url.endsWith('.svg')}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-500">
            <Car className="h-12 w-12" aria-hidden="true" />
          </div>
        )}
      </div>
      <CardBody className="space-y-5">
        <div>
          <p className="eyebrow">{vehicle.manufacturer}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">{vehicle.model}</h2>
          <p className="text-sm text-ink-600">{vehicle.year}</p>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-600">Date</dt>
            <dd className="text-right font-medium">{formatDate(preview.startAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-600">Time</dt>
            <dd className="text-right font-medium">
              {formatTime(preview.startAt)} – {formatTime(preview.endAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-600">Duration</dt>
            <dd className="text-right font-medium">{durationLabel(preview)}</dd>
          </div>
        </dl>
        <div className="border-t border-ivory-300 pt-4">
          <h3 className="font-display text-xl font-semibold">{dealership.name}</h3>
          <ul className="mt-2 space-y-2 text-sm text-ink-700">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
              {dealership.address}, {dealership.city}
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
              {dealership.openingHours}
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
              {dealership.phone}
            </li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}

interface ConfirmFormProps {
  preview: SlotPreview;
  user: User;
  onBooked: (booking: Booking) => void;
}

function ConfirmForm({ preview, user, onBooked }: ConfirmFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const needsLicence = !user.drivingLicenseNumber;
  const schema = useMemo(() => bookingConfirmSchema(needsLicence), [needsLicence]);
  const [problem, setProblem] = useState<BookingProblem | null>(null);
  const returnTo = `/book?slotId=${preview.id}`;

  const { form, submit, formError } = useApiForm({
    schema,
    defaultValues: { customerNote: '', licenceConfirmed: false, drivingLicenseNumber: '' },
    onError: error => {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') return false;
      const described = describeBookingProblem(error);
      setProblem(described);
      if (described.action === 'repick') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      }
      if (described.action === 'login')
        router.replace(`/login?next=${encodeURIComponent(returnTo)}&session=expired`);
      return true;
    },
    onSubmit: async values => {
      setProblem(null);
      if (needsLicence) {
        const updated = await api.patch<User>('/api/profile', {
          drivingLicenseNumber: values.drivingLicenseNumber,
        });
        setUser(updated);
      }
      const booking = await api.post<Booking>('/api/bookings', {
        slotId: preview.id,
        customerNote: values.customerNote || null,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      onBooked(booking);
    },
  });
  const {
    register,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const noteLength = watch('customerNote').length;

  return (
    <Card>
      <form method="post" onSubmit={submit} noValidate>
        <CardHeader>
          <h1 className="font-display text-3xl font-semibold">Confirm your test drive</h1>
          <p className="mt-1 text-sm text-ink-600">
            Review the details, then send your request to the showroom.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          {problem ? (
            <BookingProblemAlert
              problem={problem}
              vehicleId={preview.vehicle.id}
              returnTo={returnTo}
            />
          ) : null}
          <FormAlert message={formError} />

          <FormField
            label="Note for the showroom (optional)"
            hint={`${noteLength} of ${MAX_NOTE_LENGTH} characters`}
            error={errors.customerNote?.message}
          >
            {control => (
              <Textarea
                {...control}
                rows={4}
                maxLength={MAX_NOTE_LENGTH + 100}
                placeholder="Anything we should prepare, such as a preferred route or accessibility needs."
                {...register('customerNote')}
              />
            )}
          </FormField>

          {needsLicence ? (
            <FormField
              label="Driving licence number"
              hint="Your profile has no licence number yet. We will save it to your profile."
              error={errors.drivingLicenseNumber?.message}
              required
            >
              {control => (
                <Input {...control} autoComplete="off" {...register('drivingLicenseNumber')} />
              )}
            </FormField>
          ) : null}

          <Checkbox
            label="I hold a valid driving licence"
            error={errors.licenceConfirmed?.message}
            {...register('licenceConfirmed')}
          />

          <div
            role="note"
            className="flex gap-3 rounded-control bg-ivory-200 px-4 py-3 text-sm text-ink-700"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
            <p>
              <strong className="font-semibold text-ink-900">Cancellation policy.</strong> You can
              cancel this appointment from My bookings up to {preview.cancellationWindowHours} hours
              before it starts. After that, please contact the showroom directly.
            </p>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            {isSubmitting ? 'Sending your request…' : 'Confirm booking request'}
          </Button>
        </CardBody>
      </form>
    </Card>
  );
}

export function BookingConfirmation({ slotId }: { slotId: string }) {
  const { user } = useAuth();
  const [booked, setBooked] = useState<Booking | null>(null);

  const preview = useQuery({
    queryKey: ['bookings', 'slot-preview', slotId],
    queryFn: () => api.get<SlotPreview>(`/api/bookings/slots/${slotId}`),
    enabled: booked === null,
    retry: false,
  });

  if (booked) return <BookingSuccess booking={booked} />;

  if (preview.isPending) {
    return (
      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (preview.isError) {
    const notFound = preview.error instanceof ApiError && preview.error.status === 404;
    return notFound ? (
      <EmptyState
        headingLevel={1}
        title="This appointment is no longer available"
        description="The time you selected may have been withdrawn. Please choose another."
        action={<ButtonLink href="/vehicles">Browse vehicles</ButtonLink>}
      />
    ) : (
      <ErrorState
        headingLevel={1}
        title="We could not load this appointment"
        message="Please check your connection and try again."
        onRetry={() => void preview.refetch()}
      />
    );
  }

  const data = preview.data;
  if (!data.isAvailable) {
    return (
      <EmptyState
        headingLevel={1}
        title="That time is no longer available"
        description="Another customer may have just reserved it, or it has already begun. Please choose a different time."
        action={<ButtonLink href={`/vehicles/${data.vehicle.id}`}>Choose another time</ButtonLink>}
      />
    );
  }

  if (!user) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:items-start">
      <Summary preview={data} />
      <ConfirmForm preview={data} user={user} onBooked={setBooked} />
    </div>
  );
}

import { ButtonLink } from '@/components/ui/Button';

export const metadata = { title: 'Vehicle not found' };

export default function VehicleNotFound() {
  return (
    <main
      id="main-content"
      className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center"
    >
      <p className="eyebrow">Vehicle unavailable</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
        We could not find that vehicle
      </h1>
      <p className="mt-4 max-w-md text-ink-600">
        It may have been withdrawn from the collection, or the link may be incorrect.
      </p>
      <ButtonLink href="/vehicles" className="mt-8">
        Browse the collection
      </ButtonLink>
    </main>
  );
}

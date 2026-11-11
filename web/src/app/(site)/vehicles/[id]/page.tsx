import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, MapPin, Phone } from 'lucide-react';
import { BookingPanel } from '@/components/vehicles/BookingPanel';
import { VehicleGallery } from '@/components/vehicles/VehicleGallery';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card, CardBody } from '@/components/ui/Card';
import { enumLabel, formatPrice } from '@/lib/format';
import { fetchPublicResult } from '@/lib/serverApi';
import type { VehicleDetail } from '@/types';

interface PageProps {
  params: { id: string };
}

async function loadVehicle(id: string): Promise<VehicleDetail> {
  const result = await fetchPublicResult<VehicleDetail>(`/api/vehicles/${encodeURIComponent(id)}`);
  if (result.ok) return result.data;
  if (result.status === 404 || result.status === 422) notFound();
  throw new Error('The vehicle could not be loaded');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchPublicResult<VehicleDetail>(
    `/api/vehicles/${encodeURIComponent(params.id)}`,
  );
  if (!result.ok) return { title: 'Vehicle not found' };
  const vehicle = result.data;
  const title = `${vehicle.manufacturer} ${vehicle.model}`;
  const description =
    vehicle.description?.slice(0, 160) ??
    `Reserve a private test drive of the ${vehicle.year} ${title}.`;
  const image = vehicle.images.find(candidate => candidate.isPrimary) ?? vehicle.images[0];
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image.url, alt: image.altText ?? title }] : undefined,
    },
  };
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const vehicle = await loadVehicle(params.id);
  const title = `${vehicle.manufacturer} ${vehicle.model}`;

  const specs: [string, string | null][] = [
    ['Year', String(vehicle.year)],
    ['Engine', vehicle.engine],
    ['Power', vehicle.powerHp === null ? null : `${vehicle.powerHp} hp`],
    [
      '0 to 100 km/h',
      vehicle.acceleration0to100 === null ? null : `${vehicle.acceleration0to100} seconds`,
    ],
    ['Top speed', vehicle.topSpeedKmh === null ? null : `${vehicle.topSpeedKmh} km/h`],
    ['Transmission', enumLabel(vehicle.transmission)],
    ['Fuel type', enumLabel(vehicle.fuelType)],
    ['Body style', enumLabel(vehicle.vehicleType)],
    ['Seats', vehicle.seats === null ? null : String(vehicle.seats)],
    ['Colour', vehicle.color],
  ];

  return (
    <main id="main-content" className="container-page py-10">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Vehicles', href: '/vehicles' },
          { label: title },
        ]}
      />
      <header className="mb-8 mt-5">
        <p className="eyebrow">{vehicle.manufacturer}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{vehicle.model}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>{enumLabel(vehicle.vehicleType)}</Badge>
          <Badge>{enumLabel(vehicle.fuelType)}</Badge>
          <Badge>{vehicle.year}</Badge>
          <span className="ml-1 text-sm text-ink-600">
            From <strong className="text-ink-900">{formatPrice(vehicle.priceFrom)}</strong>
          </span>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="min-w-0 space-y-12">
          <VehicleGallery images={vehicle.images} title={title} />

          {vehicle.availabilityNote ? (
            <p
              role="note"
              className="rounded-control border border-gold-300 bg-gold-200/40 px-4 py-3 text-sm text-ink-800"
            >
              {vehicle.availabilityNote}
            </p>
          ) : null}

          {vehicle.description ? (
            <section aria-labelledby="overview-heading">
              <h2 id="overview-heading" className="font-display text-3xl font-semibold">
                Overview
              </h2>
              <p className="mt-3 max-w-prose leading-relaxed text-ink-700">{vehicle.description}</p>
            </section>
          ) : null}

          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="font-display text-3xl font-semibold">
              Specification
            </h2>
            <dl className="mt-4 divide-y divide-ivory-300 rounded-card border border-ivory-300 bg-white">
              {specs
                .filter((spec): spec is [string, string] => spec[1] !== null && spec[1] !== '')
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-2 gap-4 px-5 py-3 text-sm sm:grid-cols-[14rem_1fr]"
                  >
                    <dt className="text-ink-600">{label}</dt>
                    <dd className="font-medium text-ink-900">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {vehicle.features.length > 0 ? (
            <section aria-labelledby="features-heading">
              <h2 id="features-heading" className="font-display text-3xl font-semibold">
                Features
              </h2>
              <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {vehicle.features.map(feature => (
                  <li key={feature} className="flex gap-3 text-sm text-ink-800">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="showrooms-heading">
            <h2 id="showrooms-heading" className="font-display text-3xl font-semibold">
              Available at
            </h2>
            {vehicle.dealerships.length > 0 ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {vehicle.dealerships.map(dealership => (
                  <li key={dealership.id}>
                    <Card className="h-full">
                      <CardBody className="space-y-3">
                        <div>
                          <p className="eyebrow">{dealership.city}</p>
                          <h3 className="font-display text-xl font-semibold">{dealership.name}</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-ink-700">
                          <li className="flex gap-2.5">
                            <MapPin
                              className="mt-0.5 h-4 w-4 shrink-0 text-gold-700"
                              aria-hidden="true"
                            />
                            {dealership.address}
                          </li>
                          <li className="flex gap-2.5">
                            <Clock
                              className="mt-0.5 h-4 w-4 shrink-0 text-gold-700"
                              aria-hidden="true"
                            />
                            {dealership.openingHours}
                          </li>
                          <li className="flex gap-2.5">
                            <Phone
                              className="mt-0.5 h-4 w-4 shrink-0 text-gold-700"
                              aria-hidden="true"
                            />
                            {dealership.phone}
                          </li>
                        </ul>
                      </CardBody>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink-600">
                This vehicle is not currently assigned to a showroom.
              </p>
            )}
          </section>
        </div>

        <aside aria-label="Book a test drive">
          <BookingPanel vehicleId={vehicle.id} dealerships={vehicle.dealerships} />
        </aside>
      </div>
    </main>
  );
}

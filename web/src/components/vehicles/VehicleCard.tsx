import Image from 'next/image';
import Link from 'next/link';
import { CalendarClock, Car, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { enumLabel, formatDateTime, formatPrice } from '@/lib/format';
import type { VehicleListItem } from '@/types';

interface VehicleCardProps {
  vehicle: VehicleListItem;
  /** Shows the next free slot in the visitor's local time; only use in client-rendered lists. */
  showNextSlot?: boolean;
  /** Heading level of the title; use 2 when the card sits directly under the page heading. */
  headingLevel?: 2 | 3;
  /** Load the image eagerly; set for cards that appear above the fold. */
  priority?: boolean;
}

export function VehicleCard({
  vehicle,
  showNextSlot = false,
  headingLevel = 3,
  priority = false,
}: VehicleCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const image = vehicle.primaryImage;
  const cities = [...new Set(vehicle.dealerships.map(dealership => dealership.city))];
  const title = `${vehicle.manufacturer} ${vehicle.model}`;

  return (
    <Card interactive className="group relative overflow-hidden">
      <div>
        <div className="relative aspect-[16/10] overflow-hidden bg-ink-900">
          {image ? (
            <Image
              src={image.url}
              alt={image.altText ?? `${title} exterior`}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              unoptimized={image.url.endsWith('.svg')}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-500">
              <Car className="h-12 w-12" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="space-y-3 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
              {vehicle.manufacturer}
            </p>
            <Heading className="mt-1 font-display text-2xl font-semibold leading-tight">
              <Link
                href={`/vehicles/${vehicle.id}`}
                className="rounded-card after:absolute after:inset-0 after:content-['']"
              >
                {vehicle.model}
              </Link>
            </Heading>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{enumLabel(vehicle.vehicleType)}</Badge>
            <Badge>{enumLabel(vehicle.fuelType)}</Badge>
            <Badge>{vehicle.year}</Badge>
          </div>
          {showNextSlot ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-700">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-gold-700" aria-hidden="true" />
              {vehicle.nextAvailableSlotAt
                ? `Next available: ${formatDateTime(vehicle.nextAvailableSlotAt)}`
                : 'No slots available right now'}
            </p>
          ) : null}
          <div className="flex items-end justify-between gap-3 border-t border-ivory-300 pt-3">
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-600">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {cities.length > 0 ? cities.join(' · ') : 'Availability on request'}
              </span>
            </p>
            <p className="shrink-0 text-sm">
              <span className="text-ink-500">From </span>
              <span className="font-semibold text-ink-900">{formatPrice(vehicle.priceFrom)}</span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

import { addDays, format, setHours, setMinutes, startOfDay } from 'date-fns';
import Image from 'next/image';
import { BellRing, CalendarDays, Car, KeyRound, MapPin, Clock, Phone } from 'lucide-react';
import { VehicleCard } from '@/components/vehicles/VehicleCard';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { pickRandom } from '@/lib/random';
import { fetchPublic } from '@/lib/serverApi';
import type { BookingStatus, Dealership, Page, VehicleListItem } from '@/types';

/** Rendered on every request so the featured vehicles are drawn afresh on each visit. */
export const dynamic = 'force-dynamic';

const FEATURED_COUNT = 3;
/** The API's maximum page size: the featured vehicles are drawn from the whole collection. */
const COLLECTION_PAGE_SIZE = 50;

const STEPS = [
  {
    icon: Car,
    title: 'Choose your vehicle',
    text: 'Browse the collection, compare specifications and features, and find the car you want to experience.',
  },
  {
    icon: CalendarDays,
    title: 'Pick a time',
    text: 'Select a showroom, a date and one of the open time slots, then send your request.',
  },
  {
    icon: BellRing,
    title: 'Hear back',
    text: 'Our team approves, reschedules or declines your request, and you are notified straight away.',
  },
  {
    icon: KeyRound,
    title: 'Take the keys',
    text: 'Arrive at your appointment to find the car prepared. Track or cancel from My bookings.',
  },
] as const;

/** Illustrative rows for the "Every booking in one place" preview: days from today, hour, status. */
const BOOKING_PREVIEW: { days: number; hour: number; minute: number; status: BookingStatus }[] = [
  { days: 3, hour: 11, minute: 30, status: 'APPROVED' },
  { days: 6, hour: 16, minute: 0, status: 'PENDING' },
  { days: -7, hour: 10, minute: 0, status: 'COMPLETED' },
];

const FAQS = [
  {
    question: 'What should I bring?',
    answer:
      'A valid driving licence and a photo ID. Our team will check both before you take the wheel.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'You can browse the collection freely. To request a test drive and follow its progress, create a free account.',
  },
  {
    question: 'Can I cancel or change my booking?',
    answer:
      'You can cancel an upcoming booking from My bookings until 24 hours before it starts; the exact cut-off is shown when you confirm. To change the time, ask the showroom to reschedule or cancel and request a new slot.',
  },
  {
    question: 'When will I hear back?',
    answer:
      'As soon as our team approves, reschedules or declines your request, you receive a notification in your account and by email.',
  },
] as const;

const previewRows = (vehicles: VehicleListItem[], dealerships: Dealership[]) =>
  BOOKING_PREVIEW.map((row, index) => ({
    ...row,
    vehicle: vehicles[index % vehicles.length],
    dealership: dealerships[index % dealerships.length],
    startAt: setMinutes(setHours(addDays(startOfDay(new Date()), row.days), row.hour), row.minute),
  }));

export default async function HomePage() {
  const [vehicles, dealerships] = await Promise.all([
    fetchPublic<Page<VehicleListItem>>(`/api/vehicles?pageSize=${COLLECTION_PAGE_SIZE}`),
    fetchPublic<Dealership[]>('/api/dealerships'),
  ]);
  const featured = vehicles ? pickRandom(vehicles.items, FEATURED_COUNT) : [];

  return (
    <main id="main-content">
      <section className="on-dark border-b border-ink-800 bg-ink-950 text-ivory-100">
        <div className="container-page grid gap-14 py-20 sm:py-24 lg:grid-cols-12 lg:items-end lg:py-28">
          <div className="lg:col-span-7">
            <p className="eyebrow">Private test drives</p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
              Drive it before you decide.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
              Choose the car, the showroom and the hour, and request your test drive in minutes. No
              phone calls, and no waiting for someone to ring you back.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <ButtonLink href="/vehicles" size="lg">
                Browse the collection
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="light" size="lg">
                How it works
              </ButtonLink>
            </div>
          </div>
          <dl className="divide-y divide-ink-800 border-y border-ink-800 lg:col-span-4 lg:col-start-9">
            {vehicles && (
              <div className="py-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300">
                  The collection
                </dt>
                <dd className="mt-1.5 font-display text-2xl font-medium">
                  {vehicles.total} {vehicles.total === 1 ? 'vehicle' : 'vehicles'} available to
                  drive
                </dd>
              </div>
            )}
            {dealerships && dealerships.length > 0 && (
              <div className="py-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300">
                  Showrooms
                </dt>
                <dd className="mt-1.5 font-display text-2xl font-medium">
                  {dealerships.map(dealership => dealership.city).join(' · ')}
                </dd>
              </div>
            )}
            <div className="py-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-300">
                Appointments
              </dt>
              <dd className="mt-1.5 font-display text-2xl font-medium">
                Confirmed personally by our team
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="how-it-works" className="container-page scroll-mt-20 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-semibold">
            From choice to keys in four steps
          </h2>
          <p className="mt-3 text-ink-600">You always know where your request stands.</p>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardBody className="p-7">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-950 text-gold-400">
                      <step.icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-display text-5xl font-semibold leading-none text-gold-500"
                    >
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-600">{step.text}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="border-y border-ivory-300 bg-ivory-200/60 py-20"
        aria-labelledby="featured-heading"
      >
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">The collection</p>
              <h2 id="featured-heading" className="mt-3 font-display text-4xl font-semibold">
                Featured vehicles
              </h2>
            </div>
            <ButtonLink href="/vehicles" variant="outline">
              View all vehicles
            </ButtonLink>
          </div>
          {vehicles && vehicles.items.length === 0 ? (
            <EmptyState
              className="mt-10"
              title="The collection is being curated"
              description="New vehicles will be announced here shortly. Please check back soon."
            />
          ) : vehicles ? (
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(vehicle => (
                <li key={vehicle.id}>
                  <VehicleCard vehicle={vehicle} />
                </li>
              ))}
            </ul>
          ) : (
            <ErrorState
              className="mt-10"
              title="The collection is unavailable right now"
              message="We could not load our vehicles. Please refresh the page in a moment."
            />
          )}
        </div>
      </section>

      {vehicles && vehicles.items.length > 0 && dealerships && dealerships.length > 0 && (
        <section className="container-page py-20" aria-labelledby="bookings-heading">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="eyebrow">Your account</p>
              <h2 id="bookings-heading" className="mt-3 font-display text-4xl font-semibold">
                Every booking in one place
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-ink-600">
                See pending, upcoming and past test drives at a glance, and cancel an eligible
                booking in one click.
              </p>
              <ButtonLink href="/my-bookings" variant="outline" className="mt-8">
                View my bookings
              </ButtonLink>
            </div>
            <figure className="lg:col-span-7">
              <Card>
                <ul className="divide-y divide-ivory-300">
                  {previewRows(featured, dealerships).map(row => (
                    <li
                      key={row.status}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900">
                          {row.vehicle.manufacturer} {row.vehicle.model}
                        </p>
                        <p className="text-sm text-ink-500">{row.dealership.name}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-6">
                        <p className="text-right text-sm">
                          <span className="block font-semibold text-ink-900">
                            {format(row.startAt, 'EEE, d MMM')}
                          </span>
                          <span className="text-ink-500">{format(row.startAt, 'HH:mm')}</span>
                        </p>
                        <StatusBadge status={row.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
              <figcaption className="mt-3 text-sm text-ink-500">
                An example of how bookings appear in your account.
              </figcaption>
            </figure>
          </div>
        </section>
      )}

      <section
        id="showrooms"
        className="container-page scroll-mt-20 py-20"
        aria-labelledby="showrooms-heading"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Our showrooms</p>
          <h2 id="showrooms-heading" className="mt-3 font-display text-4xl font-semibold">
            Find a showroom near you
          </h2>
        </div>
        {dealerships && dealerships.length > 0 ? (
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {dealerships.map(dealership => (
              <li key={dealership.id}>
                <Card className="h-full overflow-hidden">
                  {dealership.imageUrl ? (
                    <div className="relative aspect-[16/10] bg-ink-900">
                      <Image
                        src={dealership.imageUrl}
                        alt={`Inside ${dealership.name}`}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <CardBody className="space-y-4 p-7">
                    <div>
                      <p className="eyebrow">{dealership.city}</p>
                      <h3 className="mt-1 font-display text-2xl font-semibold">
                        {dealership.name}
                      </h3>
                    </div>
                    <ul className="space-y-2.5 text-sm text-ink-700">
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
          <ErrorState
            className="mt-12"
            title="Showroom details are unavailable"
            message="We could not load our showroom locations. Please refresh the page in a moment."
          />
        )}
      </section>

      <section
        id="faq"
        className="border-t border-ivory-300 bg-ivory-200/60 py-20"
        aria-labelledby="faq-heading"
      >
        <div className="container-page max-w-3xl">
          <p className="eyebrow">Before you book</p>
          <h2 id="faq-heading" className="mt-3 font-display text-4xl font-semibold">
            Questions, answered plainly
          </h2>
          <div className="mt-10 divide-y divide-ivory-300 border-y border-ivory-300">
            {FAQS.map(faq => (
              <details key={faq.question} className="group py-5">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="font-display text-2xl font-medium leading-none text-gold-700 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="on-dark bg-ink-950 py-20 text-center text-ivory-100">
        <div className="container-page">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold sm:text-5xl">
            Your next drive is one appointment away
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-200">
            Browse the collection, find the car that stirs something, and reserve your time behind
            the wheel.
          </p>
          <ButtonLink href="/vehicles" size="lg" className="mt-8">
            Browse vehicles
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}

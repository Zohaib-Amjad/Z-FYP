import { CalendarDays, Car, KeyRound, MapPin, Clock, Phone } from 'lucide-react';
import { VehicleCard } from '@/components/vehicles/VehicleCard';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchPublic } from '@/lib/serverApi';
import type { Dealership, Page, VehicleListItem } from '@/types';

const FEATURED_COUNT = 3;

const STEPS = [
  {
    icon: Car,
    title: 'Choose your vehicle',
    text: 'Explore a curated collection of grand tourers, sports cars and SUVs, and find the one you want to experience.',
  },
  {
    icon: CalendarDays,
    title: 'Schedule your drive',
    text: 'Select a showroom, pick a date and an available time slot. Your request is held for our specialists to confirm.',
  },
  {
    icon: KeyRound,
    title: 'Take the keys',
    text: 'Arrive at your appointment and our team will have the car prepared, with a route designed to show it at its best.',
  },
] as const;

export default async function HomePage() {
  const [vehicles, dealerships] = await Promise.all([
    fetchPublic<Page<VehicleListItem>>(`/api/vehicles?pageSize=${FEATURED_COUNT}`),
    fetchPublic<Dealership[]>('/api/dealerships'),
  ]);

  return (
    <main id="main-content">
      <section className="on-dark relative isolate overflow-hidden bg-ink-950 text-ivory-100">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(212,175,55,0.18),transparent),radial-gradient(40rem_24rem_at_0%_100%,rgba(212,175,55,0.08),transparent)]"
        />
        <div className="container-page py-24 sm:py-32 lg:py-40">
          <p className="eyebrow">Private test drives</p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
            Experience the extraordinary, <span className="text-gold-300">on your terms.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
            Reserve an unhurried drive in the world’s most coveted automobiles. Choose the car, the
            showroom and the hour. We will take care of everything else.
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
      </section>

      <section id="how-it-works" className="container-page scroll-mt-20 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-semibold">
            Three steps to the driver’s seat
          </h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
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
                      className="font-display text-5xl font-semibold text-ivory-300"
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
              {vehicles.items.map(vehicle => (
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
                <Card className="h-full">
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

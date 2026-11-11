import { ShieldAlert } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { homeFor } from '@/lib/routeAccess';
import type { Role } from '@/types';

const COPY: Record<Role, { message: string; cta: string }> = {
  CUSTOMER: {
    message:
      'This area is reserved for showroom staff. Your customer account can browse vehicles and manage your own test drives.',
    cta: 'Return to the showroom',
  },
  STAFF: {
    message:
      'Booking and profile pages are for customers. Your staff account manages appointments from the administration portal.',
    cta: 'Go to the admin portal',
  },
};

export function ForbiddenPage({ role }: { role: Role }) {
  const copy = COPY[role];
  return (
    <main
      id="main-content"
      className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ivory-200 text-gold-700">
        <ShieldAlert className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="eyebrow mt-6">Error 403</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        This area is not available to you
      </h1>
      <p className="mt-3 max-w-md text-ink-600">{copy.message}</p>
      <ButtonLink href={homeFor(role)} className="mt-8">
        {copy.cta}
      </ButtonLink>
    </main>
  );
}

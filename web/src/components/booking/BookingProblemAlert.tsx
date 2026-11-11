import { AlertCircle } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import type { BookingProblem } from '@/lib/booking';

interface BookingProblemAlertProps {
  problem: BookingProblem;
  vehicleId: string;
  returnTo: string;
}

/** Friendly explanation of a failed booking, with the one action that helps. */
export function BookingProblemAlert({ problem, vehicleId, returnTo }: BookingProblemAlertProps) {
  return (
    <div role="alert" className="rounded-card border border-status-rejected/30 bg-[#fdf6f6] p-5">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-rejected" aria-hidden="true" />
        <div>
          <h3 className="font-display text-xl font-semibold text-ink-900">{problem.title}</h3>
          <p className="mt-1 text-sm text-ink-700">{problem.message}</p>
          {problem.action === 'repick' ? (
            <ButtonLink href={`/vehicles/${vehicleId}`} className="mt-4">
              Choose another time
            </ButtonLink>
          ) : null}
          {problem.action === 'myBookings' ? (
            <ButtonLink href="/my-bookings" className="mt-4">
              View my bookings
            </ButtonLink>
          ) : null}
          {problem.action === 'login' ? (
            <ButtonLink
              href={`/login?next=${encodeURIComponent(returnTo)}&session=expired`}
              className="mt-4"
            >
              Sign in
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

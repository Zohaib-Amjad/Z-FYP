import { AlertCircle } from 'lucide-react';

/** Banner for server errors that belong to no particular field. */
export function FormAlert({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive">
      {message ? (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-control border border-status-rejected/30 bg-[#fdf6f6] px-4 py-3 text-sm text-status-rejected"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </div>
  );
}

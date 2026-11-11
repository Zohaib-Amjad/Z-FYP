'use client';

import { ButtonLink, Button } from '@/components/ui/Button';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="container-page flex min-h-[70vh] flex-col items-center justify-center py-20 text-center"
    >
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
        We hit an unexpected bump
      </h1>
      <p className="mt-4 max-w-md text-ink-600">
        The page could not be displayed. Your information is safe. Please try again, or return to
        the homepage.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Return home
        </ButtonLink>
      </div>
    </main>
  );
}

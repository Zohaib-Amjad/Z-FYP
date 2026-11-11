import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  /** Use 1 when this state is the page's only content, so the page still has a heading. */
  headingLevel?: 1 | 3;
}

export function ErrorState({
  title = 'We could not load this',
  message = 'Something went wrong on our side. Please try again in a moment.',
  onRetry,
  className,
  headingLevel = 3,
}: ErrorStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h3';
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-card border border-status-rejected/30 bg-[#fdf6f6] px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fbe8ea] text-status-rejected">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <Heading className="mt-4 font-display text-xl font-semibold">{title}</Heading>
      <p className="mt-1.5 max-w-md text-sm text-ink-600">{message}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

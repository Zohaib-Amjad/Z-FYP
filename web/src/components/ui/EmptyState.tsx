import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  /** Use 1 when this state is the page's only content, so the page still has a heading. */
  headingLevel?: 1 | 3;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h3';
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ivory-200 text-gold-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <Heading className="mt-4 font-display text-xl font-semibold">{title}</Heading>
      {description ? <p className="mt-1.5 max-w-md text-sm text-ink-600">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

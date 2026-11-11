import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-8', className)}>
      {breadcrumbs ? <div className="mb-4">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-ink-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

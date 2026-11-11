import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-control bg-ink-200/70 motion-reduce:animate-none',
        className,
      )}
      {...rest}
    />
  );
}

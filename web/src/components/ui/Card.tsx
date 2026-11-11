import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'light' | 'dark';
  interactive?: boolean;
}

export function Card({ tone = 'light', interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border',
        tone === 'light'
          ? 'border-ivory-300 bg-white text-ink-900 shadow-soft'
          : 'on-dark border-ink-700 bg-ink-900 text-ivory-100',
        interactive && 'transition-shadow duration-200 hover:shadow-lift',
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-inherit px-5 py-4 sm:px-6', className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t border-inherit px-5 py-4 sm:px-6', className)} {...rest} />;
}

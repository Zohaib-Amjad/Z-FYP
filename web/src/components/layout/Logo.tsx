import Link from 'next/link';
import { cn } from '@/lib/cn';

interface LogoProps {
  tone?: 'dark' | 'light';
  href?: string;
  className?: string;
}

export function Logo({ tone = 'dark', href = '/', className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn('group inline-flex min-h-[44px] items-center gap-2.5', className)}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400 font-display text-lg font-bold text-gold-400"
      >
        P
      </span>
      <span className="leading-none">
        <span
          className={cn(
            'block font-display text-xl font-semibold tracking-wide',
            tone === 'light' ? 'text-ivory-100' : 'text-ink-950',
          )}
        >
          Prestige
        </span>
        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-gold-500">
          Test Drive
        </span>
      </span>
    </Link>
  );
}

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { LogoMark } from './LogoMark';

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
      <LogoMark className={cn('h-9 w-9', tone === 'light' ? 'text-gold-400' : 'text-gold-600')} />
      <span
        className={cn(
          'font-display text-2xl font-semibold leading-none tracking-wide',
          tone === 'light' ? 'text-ivory-100' : 'text-ink-950',
        )}
      >
        Lux
        <span className={tone === 'light' ? 'text-gold-400' : 'text-gold-700'}>Drive</span>
      </span>
    </Link>
  );
}

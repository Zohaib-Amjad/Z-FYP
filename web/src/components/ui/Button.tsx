import Link from 'next/link';
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'light';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gold-400 text-ink-950 hover:bg-gold-300 active:bg-gold-500 shadow-soft disabled:hover:bg-gold-400',
  secondary: 'bg-ink-900 text-ivory-100 hover:bg-ink-700 active:bg-ink-800',
  outline: 'border border-ink-300 bg-transparent text-ink-900 hover:border-ink-900 hover:bg-ink-50',
  ghost: 'bg-transparent text-ink-800 hover:bg-ink-100',
  danger: 'bg-status-rejected text-white hover:bg-[#8a2330] active:bg-[#741c28]',
  light: 'border border-ivory-300/40 bg-transparent text-ivory-100 hover:bg-ivory-100/10',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-11 px-3.5 text-sm sm:h-9',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-wide transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" label="Working" /> : null}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({ href, variant, size, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

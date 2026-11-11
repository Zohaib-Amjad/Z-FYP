import { cn } from '@/lib/cn';

/** Shared look for text-like controls (Input, Select, Textarea). */
export function controlClasses(className?: string): string {
  return cn(
    'block w-full rounded-control border border-ink-300 bg-white px-3.5 text-sm text-ink-900',
    'placeholder:text-ink-400 transition-colors hover:border-ink-400',
    'focus-visible:border-gold-600',
    'aria-[invalid=true]:border-status-rejected aria-[invalid=true]:bg-[#fdf6f6]',
    'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
    className,
  );
}

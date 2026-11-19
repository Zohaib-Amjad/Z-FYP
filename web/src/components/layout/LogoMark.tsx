import { cn } from '@/lib/cn';

/**
 * The LuxDrive emblem: an open ring, read as a steering wheel or a dial, with an "L" whose foot
 * runs out through the gap and narrows like a road. Drawn in currentColor.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      fill="currentColor"
    >
      <path
        d="M40.58 35.18A20 20 0 1 1 43.81 26.78"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M16 11h4.5v18.5L46 30.6v1.3L16 33z" />
    </svg>
  );
}

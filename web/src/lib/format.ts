import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

const ENUM_LABELS: Record<string, string> = {
  PLUG_IN_HYBRID: 'Plug-in hybrid',
  DUAL_CLUTCH: 'Dual-clutch',
  GRAND_TOURER: 'Grand tourer',
  SUV: 'SUV',
  MPV: 'MPV',
};

/** Turns an API enum value such as PLUG_IN_HYBRID into reader-friendly text. */
export function enumLabel(value: string): string {
  const known = ENUM_LABELS[value];
  if (known) return known;
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const currency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number | null): string {
  return amount === null ? 'Price on request' : currency.format(amount);
}

function toDate(value: string | Date): Date | null {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

/** All UI times are shown in the visitor's local time zone. */
export function formatDate(value: string | Date): string {
  const date = toDate(value);
  return date ? format(date, 'EEE d MMM yyyy') : '';
}

export function formatTime(value: string | Date): string {
  const date = toDate(value);
  return date ? format(date, 'HH:mm') : '';
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  return date ? format(date, 'EEE d MMM yyyy, HH:mm') : '';
}

export function formatRelative(value: string | Date): string {
  const date = toDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : '';
}

export function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function initials(user: { firstName: string; lastName: string }): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

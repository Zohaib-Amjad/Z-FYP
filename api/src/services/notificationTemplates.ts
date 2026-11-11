import type { NotificationType } from '@prisma/client';
import type { BookingDto } from '../utils/bookingDto';
import { formatSlotWindow } from '../utils/formatSlot';

export type Actor = 'STAFF' | 'CUSTOMER';

export interface PreviousSlot {
  startAt: Date;
  endAt: Date;
  dealershipName: string;
}

export interface NotificationVars {
  booking: BookingDto;
  actor?: Actor;
  reason?: string;
  note?: string;
  previousSlot?: PreviousSlot;
}

export interface NotificationContent {
  title: string;
  message: string;
  subject: string;
  text: string;
  html: string;
}

const TITLES: Record<NotificationType, string> = {
  BOOKING_CREATED: 'Test-drive request received',
  BOOKING_APPROVED: 'Test drive confirmed',
  BOOKING_REJECTED: 'Test-drive request declined',
  BOOKING_RESCHEDULED: 'Test drive rescheduled',
  BOOKING_CANCELLED: 'Test drive cancelled',
  BOOKING_COMPLETED: 'Thank you for visiting',
};

const STATUS_LABELS: Record<NotificationType, string> = {
  BOOKING_CREATED: 'Pending approval',
  BOOKING_APPROVED: 'Confirmed',
  BOOKING_REJECTED: 'Declined',
  BOOKING_RESCHEDULED: 'Rescheduled',
  BOOKING_CANCELLED: 'Cancelled',
  BOOKING_COMPLETED: 'Completed',
};

const GOLD = '#b8975a';
const CHARCOAL = '#16161a';
const IVORY = '#f6f1e7';
const STONE = '#6b665c';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sentence = (text: string | undefined, prefix: string): string =>
  text ? ` ${prefix} ${text.replace(/\.$/, '')}.` : '';

const vehicleName = ({ booking }: NotificationVars): string =>
  `${booking.vehicle.manufacturer} ${booking.vehicle.model}`;

const bookingSummary = (vars: NotificationVars): string => {
  const { dealership, slot } = vars.booking;
  return `${vehicleName(vars)} at ${dealership.name} on ${formatSlotWindow(slot.startAt, slot.endAt)}`;
};

const messageFor = (type: NotificationType, vars: NotificationVars): string => {
  const { booking, actor, reason, note, previousSlot } = vars;
  switch (type) {
    case 'BOOKING_CREATED':
      return `Your request to test drive the ${bookingSummary(vars)} has been received. We will confirm it shortly.`;
    case 'BOOKING_APPROVED':
      return `Your test drive of the ${bookingSummary(vars)} has been confirmed.${sentence(note, 'A note from our team:')}`;
    case 'BOOKING_REJECTED':
      return `We are unable to accommodate your request to test drive the ${bookingSummary(vars)}.${sentence(reason, 'Reason:')}`;
    case 'BOOKING_RESCHEDULED': {
      const from = previousSlot
        ? `from ${formatSlotWindow(previousSlot.startAt, previousSlot.endAt)} at ${previousSlot.dealershipName} `
        : '';
      return `Your test drive of the ${vehicleName(vars)} has been moved ${from}to ${formatSlotWindow(booking.slot.startAt, booking.slot.endAt)} at ${booking.dealership.name}.${sentence(note, 'A note from our team:')}`;
    }
    case 'BOOKING_CANCELLED':
      return actor === 'CUSTOMER'
        ? `You have cancelled your test drive of the ${bookingSummary(vars)}.${sentence(reason, 'Your reason:')}`
        : `Your test drive of the ${bookingSummary(vars)} has been cancelled by our team.${sentence(reason, 'Reason:')}`;
    case 'BOOKING_COMPLETED':
      return `Thank you for test driving the ${bookingSummary(vars)}. We hope you enjoyed the experience and are here for any follow-up.${sentence(note, 'A note from our team:')}`;
  }
};

type Detail = [label: string, value: string];

const detailsFor = (type: NotificationType, vars: NotificationVars): Detail[] => {
  const { booking } = vars;
  const details: Detail[] = [
    ['Vehicle', `${vehicleName(vars)} (${booking.vehicle.year})`],
    [
      'Dealership',
      `${booking.dealership.name}, ${booking.dealership.address}, ${booking.dealership.city}`,
    ],
    ['Date and time', formatSlotWindow(booking.slot.startAt, booking.slot.endAt)],
  ];
  if (type === 'BOOKING_RESCHEDULED' && vars.previousSlot) {
    details.push([
      'Previously',
      `${formatSlotWindow(vars.previousSlot.startAt, vars.previousSlot.endAt)} at ${vars.previousSlot.dealershipName}`,
    ]);
  }
  details.push(['Status', STATUS_LABELS[type]]);
  return details;
};

const renderText = (greeting: string, message: string, details: Detail[]): string =>
  [
    greeting,
    '',
    message,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    'With our compliments,',
    'Prestige Test Drive',
  ].join('\n');

const renderHtml = (
  title: string,
  greeting: string,
  message: string,
  details: Detail[],
): string => {
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e4dccb;font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${STONE};width:34%;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e4dccb;font-family:${SANS};font-size:15px;color:${CHARCOAL};vertical-align:top;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${IVORY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e4dccb;">
<tr><td style="background:${CHARCOAL};padding:28px 32px;text-align:center;"><span style="font-family:${SERIF};font-size:22px;letter-spacing:8px;color:${GOLD};">PRESTIGE</span></td></tr>
<tr><td style="padding:36px 32px 8px 32px;"><h1 style="margin:0 0 20px 0;font-family:${SERIF};font-weight:normal;font-size:26px;color:${CHARCOAL};">${escapeHtml(title)}</h1>
<p style="margin:0 0 12px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${CHARCOAL};">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${CHARCOAL};">${escapeHtml(message)}</p></td></tr>
<tr><td style="padding:0 32px 28px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${GOLD};">${rows}</table></td></tr>
<tr><td style="padding:0 32px 36px 32px;font-family:${SERIF};font-size:15px;color:${CHARCOAL};">With our compliments,<br><span style="color:${GOLD};">Prestige Test Drive</span></td></tr>
<tr><td style="background:${CHARCOAL};padding:18px 32px;text-align:center;font-family:${SANS};font-size:11px;letter-spacing:1px;color:#9d978a;">PRESTIGE TEST DRIVE &middot; PRIVATE VIEWINGS BY APPOINTMENT</td></tr>
</table></td></tr></table></body></html>`;
};

export const buildNotificationContent = (
  type: NotificationType,
  vars: NotificationVars,
): NotificationContent => {
  const title = TITLES[type];
  const message = messageFor(type, vars);
  const greeting = `Dear ${vars.booking.customer.firstName},`;
  const details = detailsFor(type, vars);
  return {
    title,
    message,
    subject: `${title}: ${vehicleName(vars)}`,
    text: renderText(greeting, message, details),
    html: renderHtml(title, greeting, message, details),
  };
};

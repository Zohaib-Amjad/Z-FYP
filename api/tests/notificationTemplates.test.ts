import type { NotificationType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  NotificationVars,
  buildNotificationContent,
  escapeHtml,
} from '../src/services/notificationTemplates';
import type { BookingDto } from '../src/utils/bookingDto';

const TYPES: NotificationType[] = [
  'BOOKING_CREATED',
  'BOOKING_APPROVED',
  'BOOKING_REJECTED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
];

const booking = (overrides: Partial<BookingDto> = {}): BookingDto => ({
  id: '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11',
  status: 'PENDING',
  customerNote: null,
  staffNote: null,
  rejectionReason: null,
  cancellationReason: null,
  cancelledBy: null,
  approvedAt: null,
  completedAt: null,
  createdAt: new Date('2030-01-01T00:00:00Z'),
  updatedAt: new Date('2030-01-01T00:00:00Z'),
  customer: {
    id: 'c1',
    firstName: 'Amelia',
    lastName: 'Hart',
    email: 'amelia@example.test',
    phone: '+44 7700 900111',
  },
  slot: {
    id: 's1',
    startAt: new Date('2030-03-12T10:00:00Z'),
    endAt: new Date('2030-03-12T11:00:00Z'),
  },
  vehicle: {
    id: 'v1',
    manufacturer: 'Porsche',
    model: '911 Carrera T',
    year: 2025,
    primaryImage: null,
  },
  dealership: {
    id: 'd1',
    name: 'Prestige Mayfair',
    address: '14 Berkeley Square',
    city: 'London',
    phone: '+44 20 7946 1000',
  },
  ...overrides,
});

const previousSlot = {
  startAt: new Date('2030-03-05T14:00:00Z'),
  endAt: new Date('2030-03-05T15:00:00Z'),
  dealershipName: 'Prestige Deansgate',
};

const build = (type: NotificationType, vars: Partial<NotificationVars> = {}) =>
  buildNotificationContent(type, { booking: booking(), ...vars });

describe('notification content for every type', () => {
  it.each(TYPES)('%s names the vehicle, dealership, date and time', type => {
    const content = build(type, { previousSlot });

    for (const field of [content.message, content.text, content.html]) {
      expect(field).toContain('Porsche 911 Carrera T');
      expect(field).toContain('Prestige Mayfair');
    }
    expect(content.message).toContain('Tuesday, 12 March 2030, 10:00 to 11:00 UTC');
    expect(content.text).toContain('Tuesday, 12 March 2030, 10:00 to 11:00 UTC');
    expect(content.subject.startsWith(content.title)).toBe(true);
    expect(content.subject).toContain('Porsche 911 Carrera T');
  });

  it('uses a distinct title per type', () => {
    const titles = TYPES.map(type => build(type).title);

    expect(new Set(titles).size).toBe(TYPES.length);
  });

  it('greets the customer by first name in both formats', () => {
    const content = build('BOOKING_APPROVED');

    expect(content.text.startsWith('Dear Amelia,')).toBe(true);
    expect(content.html).toContain('Dear Amelia,');
  });
});

describe('type-specific wording', () => {
  it('BOOKING_CREATED says the request is awaiting confirmation', () => {
    expect(build('BOOKING_CREATED').message).toContain('has been received');
    expect(build('BOOKING_CREATED').text).toContain('Status: Pending approval');
  });

  it('BOOKING_APPROVED includes the staff note when there is one', () => {
    expect(build('BOOKING_APPROVED', { note: 'Please bring your licence.' }).message).toContain(
      'A note from our team: Please bring your licence.',
    );
    expect(build('BOOKING_APPROVED').message).not.toContain('note from our team');
  });

  it('BOOKING_REJECTED includes the reason, normalising the final full stop', () => {
    const withStop = build('BOOKING_REJECTED', { reason: 'Reserved for a press event.' }).message;
    const without = build('BOOKING_REJECTED', { reason: 'Reserved for a press event' }).message;

    expect(withStop).toContain('Reason: Reserved for a press event.');
    expect(withStop).not.toContain('..');
    expect(without).toBe(withStop);
    expect(build('BOOKING_REJECTED').message).not.toContain('Reason');
  });

  it('BOOKING_RESCHEDULED gives the old and the new date, time and dealership', () => {
    const content = build('BOOKING_RESCHEDULED', { previousSlot, note: 'Vehicle service' });

    expect(content.message).toContain(
      'moved from Tuesday, 5 March 2030, 14:00 to 15:00 UTC at Prestige Deansgate',
    );
    expect(content.message).toContain(
      'to Tuesday, 12 March 2030, 10:00 to 11:00 UTC at Prestige Mayfair',
    );
    expect(content.message).toContain('A note from our team: Vehicle service.');
    expect(content.text).toContain(
      'Previously: Tuesday, 5 March 2030, 14:00 to 15:00 UTC at Prestige Deansgate',
    );
  });

  it('BOOKING_RESCHEDULED still reads well without the previous slot', () => {
    const content = build('BOOKING_RESCHEDULED');

    expect(content.message).toContain('has been moved to Tuesday, 12 March 2030');
    expect(content.text).not.toContain('Previously');
  });

  it('BOOKING_CANCELLED says who cancelled and why', () => {
    const staff = build('BOOKING_CANCELLED', { actor: 'STAFF', reason: 'Vehicle sold' }).message;
    const customer = build('BOOKING_CANCELLED', {
      actor: 'CUSTOMER',
      reason: 'Plans changed',
    }).message;
    const unspecified = build('BOOKING_CANCELLED', { reason: 'Account deactivated' }).message;

    expect(staff).toContain('cancelled by our team');
    expect(staff).toContain('Reason: Vehicle sold.');
    expect(customer).toContain('You have cancelled');
    expect(customer).toContain('Your reason: Plans changed.');
    expect(unspecified).toContain('cancelled by our team');
    expect(build('BOOKING_CANCELLED', { actor: 'CUSTOMER' }).message).not.toContain('reason');
  });

  it('BOOKING_COMPLETED thanks the customer', () => {
    expect(build('BOOKING_COMPLETED').message).toContain('Thank you for test driving');
    expect(build('BOOKING_COMPLETED').text).toContain('Status: Completed');
  });
});

describe('email layout', () => {
  it('produces a complete, self-contained HTML document in the Prestige style', () => {
    const { html } = build('BOOKING_APPROVED');

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('PRESTIGE');
    expect(html).toContain('#b8975a');
    expect(html).toContain('Georgia');
    expect(html).toContain('Test drive confirmed');
    for (const label of ['Vehicle', 'Dealership', 'Date and time', 'Status']) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toContain('<script');
  });

  it('plain text carries the same facts without any markup', () => {
    const { text } = build('BOOKING_APPROVED');

    expect(text).not.toMatch(/<[a-z/][^>]*>/i);
    expect(text).toContain('Vehicle: Porsche 911 Carrera T (2025)');
    expect(text).toContain('Dealership: Prestige Mayfair, 14 Berkeley Square, London');
    expect(text).toContain('Status: Confirmed');
    expect(text.trimEnd().endsWith('Prestige Test Drive')).toBe(true);
  });

  it('escapes user-supplied text so it cannot inject markup', () => {
    const hostile = '<script>alert(1)</script> & "quotes" \'apostrophes\'';
    const content = buildNotificationContent('BOOKING_REJECTED', {
      booking: booking({
        customer: { ...booking().customer, firstName: '<b>Amelia</b>' },
        vehicle: { ...booking().vehicle, manufacturer: 'Mercedes-AMG & Co' },
      }),
      reason: hostile,
    });

    expect(content.html).not.toContain('<script>');
    expect(content.html).not.toContain('<b>Amelia</b>');
    expect(content.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(content.html).toContain('&amp; &quot;quotes&quot;');
    expect(content.html).toContain('Mercedes-AMG &amp; Co');
  });

  it('escapeHtml handles every special character', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
    expect(escapeHtml('plain')).toBe('plain');
  });
});

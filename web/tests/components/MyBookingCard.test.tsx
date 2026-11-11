// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MyBookingCard } from '@/components/bookings/MyBookingCard';
import type { MyBooking } from '@/types';

const FUTURE = new Date(Date.now() + 5 * 86_400_000).toISOString();

const booking = (overrides: Partial<MyBooking> = {}): MyBooking => ({
  id: 'b1',
  status: 'APPROVED',
  customerNote: null,
  staffNote: null,
  rejectionReason: null,
  cancellationReason: null,
  cancelledBy: null,
  approvedAt: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
  slotId: 's1',
  startAt: FUTURE,
  endAt: FUTURE,
  vehicle: {
    id: 'v1',
    manufacturer: 'Porsche',
    model: '911 Carrera T',
    year: 2025,
    name: 'Porsche 911 Carrera T',
    primaryImage: null,
  },
  dealership: {
    id: 'd1',
    name: 'Prestige Mayfair',
    address: '14 Berkeley Square',
    city: 'London',
    phone: '+44',
    openingHours: '9-5',
  },
  canCancel: true,
  cancelBlockedReason: null,
  ...overrides,
});

describe('MyBookingCard cancel eligibility', () => {
  it('offers Cancel when the booking can be cancelled, and reports which booking', () => {
    const onCancel = vi.fn();
    const item = booking();
    render(<MyBookingCard booking={item} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
    expect(onCancel).toHaveBeenCalledWith(item);
  });

  it('explains why instead of offering Cancel inside the cancellation window', () => {
    const reason = 'Appointments can only be cancelled at least 24 hours in advance.';
    render(
      <MyBookingCard
        booking={booking({ canCancel: false, cancelBlockedReason: reason })}
        onCancel={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Cancel appointment' })).toBeNull();
    expect(screen.getByText(reason)).toBeTruthy();
  });

  it.each(['COMPLETED', 'CANCELLED', 'REJECTED'] as const)(
    'shows neither a button nor a hint for a %s booking',
    status => {
      render(
        <MyBookingCard
          booking={booking({
            status,
            canCancel: false,
            cancelBlockedReason: 'Should not be shown',
          })}
          onCancel={() => undefined}
        />,
      );

      expect(screen.queryByRole('button', { name: 'Cancel appointment' })).toBeNull();
      expect(screen.queryByText('Should not be shown')).toBeNull();
    },
  );

  it('shows the showroom reason for a rejected request and a link to the details', () => {
    render(
      <MyBookingCard
        booking={booking({
          status: 'REJECTED',
          rejectionReason: 'Vehicle in service that day',
          canCancel: false,
        })}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText('Vehicle in service that day')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View details' }).getAttribute('href')).toBe(
      '/my-bookings/b1',
    );
    expect(screen.getByText('Rejected')).toBeTruthy();
  });
});

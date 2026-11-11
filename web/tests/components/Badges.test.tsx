// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActiveBadge, STATUS_LABELS, StatusBadge } from '@/components/ui/Badge';
import { BOOKING_STATUSES } from '@/types';

describe('StatusBadge mapping', () => {
  it('has a label for every booking status', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...BOOKING_STATUSES].sort());
  });

  it.each([
    ['PENDING', 'Pending'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Rejected'],
    ['CANCELLED', 'Cancelled'],
    ['COMPLETED', 'Completed'],
    ['RESCHEDULED', 'Rescheduled'],
  ] as const)(
    'shows %s as readable text, so colour is never the only indicator',
    (status, label) => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    },
  );

  it('gives every status its own colour treatment', () => {
    const classes = BOOKING_STATUSES.map(status => {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const value = (container.firstChild as HTMLElement).className;
      unmount();
      return value;
    });
    expect(new Set(classes).size).toBe(BOOKING_STATUSES.length);
  });
});

describe('ActiveBadge', () => {
  it('says Active or Inactive in words', () => {
    const { rerender } = render(<ActiveBadge active />);
    expect(screen.getByText('Active')).toBeTruthy();

    rerender(<ActiveBadge active={false} />);
    expect(screen.getByText('Inactive')).toBeTruthy();
  });
});

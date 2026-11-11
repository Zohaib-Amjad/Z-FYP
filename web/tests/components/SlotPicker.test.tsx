// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlotPicker } from '@/components/booking/SlotPicker';
import { toDateKey } from '@/lib/calendar';

const tomorrow = new Date(Date.now() + 86_400_000);
tomorrow.setHours(10, 0, 0, 0);
const DAY = toDateKey(tomorrow);
const dealership = { id: 'd1', name: 'Prestige Mayfair', city: 'London' };

const slot = (id: string, hour: number) => {
  const start = new Date(tomorrow);
  start.setHours(hour);
  return {
    id,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3_600_000).toISOString(),
    dealership,
  };
};

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status === 200 ? { success: true, data } : data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const availability = (slots: ReturnType<typeof slot>[]) => ({
  vehicleId: 'v1',
  timeZone: 'UTC',
  range: {
    from: new Date().toISOString(),
    to: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  },
  dates: slots.length > 0 ? [DAY] : [],
  slotsByDate: slots.length > 0 ? { [DAY]: slots } : {},
});

const renderPicker = (props: Partial<Parameters<typeof SlotPicker>[0]> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = props.onSelect ?? vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SlotPicker
        vehicleId="v1"
        dealershipId="d1"
        selectedSlotId={null}
        onSelect={onSelect}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSelect };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SlotPicker states', () => {
  it('shows a loading skeleton first', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderPicker();
    expect(document.querySelector('[aria-hidden="true"].animate-pulse')).not.toBeNull();
  });

  it('explains when there are no open appointments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope(availability([]))));
    renderPicker();

    expect(await screen.findByText(/no open appointments at this showroom/i)).toBeTruthy();
  });

  it('shows a retryable error when the schedule cannot be loaded', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        envelope({ success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500),
      )
      .mockResolvedValue(envelope(availability([slot('s1', 10)])));
    vi.stubGlobal('fetch', fetchMock);
    renderPicker();

    expect(await screen.findByText('We could not load the schedule')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Choose a highlighted date/)).toBeTruthy();
  });

  it('lets the visitor pick an available day and then a time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(envelope(availability([slot('s1', 10), slot('s2', 11)]))),
    );
    const { onSelect } = renderPicker();

    const dayButtons = await screen.findAllByRole('button', { name: /slots available/ });
    expect(dayButtons).toHaveLength(1);
    expect(
      screen
        .getAllByRole('button', { name: /no slots/ })
        .every(button => (button as HTMLButtonElement).disabled),
    ).toBe(true);

    fireEvent.click(dayButtons[0]);
    const times = await screen.findAllByRole('button', { pressed: false, name: /–/ });
    expect(times).toHaveLength(2);

    fireEvent.click(times[1]);
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 's2' }));
  });

  it('clears the selection when the chosen slot has been taken meanwhile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope(availability([slot('s1', 10)]))));
    const { onSelect } = renderPicker({ selectedSlotId: 'gone' });

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
  });

  it('keeps a still-available selection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope(availability([slot('s1', 10)]))));
    const { onSelect } = renderPicker({ selectedSlotId: 's1' });

    await screen.findAllByRole('button', { name: /slots available/ });
    expect(onSelect).not.toHaveBeenCalledWith(null);
  });
});

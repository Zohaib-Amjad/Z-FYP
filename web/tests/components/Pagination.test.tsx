// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '@/components/ui/Pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('marks the current page and collapses distant pages', () => {
    render(<Pagination page={5} totalPages={10} onPageChange={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Page 5' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 10' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Page 8' })).toBeNull();
    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('reports the chosen page, and steps with previous and next', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={6} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Page 6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange.mock.calls.map(call => call[0])).toEqual([6, 2, 4]);
  });

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(
      <Pagination page={1} totalPages={4} onPageChange={() => undefined} />,
    );
    expect(
      (screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    rerender(<Pagination page={4} totalPages={4} onPageChange={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('is a labelled navigation landmark', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={() => undefined} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  });
});

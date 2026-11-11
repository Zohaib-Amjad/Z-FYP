// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type Column } from '@/components/ui/DataTable';

interface Row {
  id: string;
  name: string;
  city: string;
}

const rows: Row[] = [
  { id: '1', name: 'Prestige Mayfair', city: 'London' },
  { id: '2', name: 'Prestige Deansgate', city: 'Manchester' },
];

const columns: Column<Row>[] = [
  { key: 'name', header: 'Showroom', cell: row => row.name },
  { key: 'city', header: 'City', cell: row => row.city },
];

const renderTable = (props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) =>
  render(
    <DataTable
      caption="Showrooms"
      columns={columns}
      rows={rows}
      rowKey={row => row.id}
      {...props}
    />,
  );

describe('DataTable responsive behaviour', () => {
  it('renders a real table for desktop and stacked cards for mobile, with the same data', () => {
    renderTable();

    const table = screen.getByRole('table', { name: 'Showrooms' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('columnheader', { name: 'City' })).toBeTruthy();
    expect(table.closest('div')?.className).toMatch(/hidden .*md:block/);

    const cards = screen.getByRole('list', { name: 'Showrooms' });
    expect(cards.className).toMatch(/md:hidden/);
    const items = within(cards).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Prestige Mayfair');
    expect(items[0].textContent).toContain('London');
  });

  it('labels each value on a card with its column header', () => {
    renderTable();

    const first = within(screen.getByRole('list', { name: 'Showrooms' })).getAllByRole(
      'listitem',
    )[0];
    expect(within(first).getByText('Showroom')).toBeTruthy();
    expect(within(first).getByText('City')).toBeTruthy();
  });

  it('can hide the label of a headline cell on cards only', () => {
    renderTable({ columns: [{ ...columns[0], hideLabelOnCard: true }, columns[1]] });

    const first = within(screen.getByRole('list', { name: 'Showrooms' })).getAllByRole(
      'listitem',
    )[0];
    expect(within(first).queryByText('Showroom')).toBeNull();
    expect(
      within(screen.getByRole('table')).getByRole('columnheader', { name: 'Showroom' }),
    ).toBeTruthy();
  });

  it('shows skeleton rows while loading instead of data', () => {
    renderTable({ loading: true });

    expect(screen.queryByText('Prestige Mayfair')).toBeNull();
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(2);
  });

  it('renders the empty state instead of an empty table', () => {
    renderTable({ rows: [], empty: <p>No showrooms yet</p> });

    expect(screen.getByText('No showrooms yet')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

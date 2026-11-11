import { describe, expect, it } from 'vitest';
import { fromDateKey, monthGrid, shiftMonth, toDateKey } from '@/lib/calendar';

describe('monthGrid', () => {
  it('starts on Monday and covers whole weeks', () => {
    const cells = monthGrid(new Date(2026, 10, 1));

    expect(cells[0].key).toBe('2026-10-26');
    expect(cells.at(-1)?.key).toBe('2026-12-06');
    expect(cells.length % 7).toBe(0);
  });

  it('marks only days of the shown month as in-month', () => {
    const cells = monthGrid(new Date(2026, 10, 1));
    const inMonth = cells.filter(cell => cell.inMonth);

    expect(inMonth).toHaveLength(30);
    expect(inMonth[0].key).toBe('2026-11-01');
    expect(inMonth.at(-1)?.key).toBe('2026-11-30');
  });
});

describe('date keys', () => {
  it('round-trips without shifting the day', () => {
    expect(toDateKey(fromDateKey('2026-03-29'))).toBe('2026-03-29');
    expect(toDateKey(fromDateKey('2026-12-31'))).toBe('2026-12-31');
  });

  it('shifts months from the first day', () => {
    expect(toDateKey(shiftMonth(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(toDateKey(shiftMonth(new Date(2026, 0, 15), -1))).toBe('2025-12-01');
  });
});

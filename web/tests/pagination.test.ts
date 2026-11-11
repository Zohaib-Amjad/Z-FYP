import { describe, expect, it } from 'vitest';
import { pageWindow } from '@/lib/pagination';

describe('pageWindow', () => {
  it('returns nothing without pages and one entry for a single page', () => {
    expect(pageWindow(1, 0)).toEqual([]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it('lists every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('collapses distant pages into a gap', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 9, 10]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
  });

  it('fills a gap of exactly one page instead of showing an ellipsis', () => {
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, 'gap', 8]);
    expect(pageWindow(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('honours the sibling count', () => {
    expect(pageWindow(6, 12, 2)).toEqual([1, 'gap', 4, 5, 6, 7, 8, 'gap', 12]);
  });
});

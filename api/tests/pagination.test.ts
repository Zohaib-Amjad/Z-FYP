import { describe, expect, it } from 'vitest';
import { buildPage, toSkipTake } from '../src/utils/pagination';

describe('pagination helpers', () => {
  it('computes skip and take', () => {
    expect(toSkipTake({ page: 1, pageSize: 10 })).toEqual({ skip: 0, take: 10 });
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it('builds the page envelope', () => {
    expect(buildPage(['a', 'b'], 23, { page: 2, pageSize: 10 })).toEqual({
      items: ['a', 'b'],
      page: 2,
      pageSize: 10,
      total: 23,
      totalPages: 3,
    });
  });

  it('reports zero pages for an empty result', () => {
    expect(buildPage([], 0, { page: 1, pageSize: 10 }).totalPages).toBe(0);
  });
});

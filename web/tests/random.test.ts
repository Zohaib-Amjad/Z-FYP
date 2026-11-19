import { describe, expect, it } from 'vitest';
import { pickRandom } from '@/lib/random';

const items = ['a', 'b', 'c', 'd', 'e'];

describe('pickRandom', () => {
  it('returns the requested number of distinct items from the list', () => {
    const picked = pickRandom(items, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    picked.forEach(item => expect(items).toContain(item));
  });

  it('follows the random source, so different draws give different selections', () => {
    expect(pickRandom(items, 3, () => 0)).toEqual(['a', 'b', 'c']);
    expect(pickRandom(items, 3, () => 0.99)).toEqual(['e', 'a', 'b']);
  });

  it('never returns more items than exist, and leaves the input unchanged', () => {
    const copy = [...items];
    expect(pickRandom(items, 10)).toHaveLength(5);
    expect(pickRandom(items, 0)).toEqual([]);
    expect(pickRandom([], 3)).toEqual([]);
    expect(items).toEqual(copy);
  });
});

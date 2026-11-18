/**
 * Returns up to `count` items chosen at random, without repeats, using a partial Fisher–Yates shuffle.
 * The input array is left untouched. `random` can be replaced in tests for a predictable result.
 */
export function pickRandom<T>(items: readonly T[], count: number, random = Math.random): T[] {
  const pool = [...items];
  const take = Math.max(0, Math.min(count, pool.length));
  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}

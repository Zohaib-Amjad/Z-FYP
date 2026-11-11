import { describe, expect, it } from 'vitest';
import { escapeLike } from '../src/utils/likeEscape';

describe('escapeLike', () => {
  it.each([
    ['plain text', 'plain text'],
    ['50%', '50\\%'],
    ['seat_heating', 'seat\\_heating'],
    ['back\\slash', 'back\\\\slash'],
    ['%_\\', '\\%\\_\\\\'],
  ])('escapes %s', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});

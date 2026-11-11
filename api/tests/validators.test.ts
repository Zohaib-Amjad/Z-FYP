import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  isoDateTimeSchema,
  paginationQuerySchema,
  passwordSchema,
  phoneSchema,
  uuidSchema,
} from '../src/validators/common';

describe('common validators', () => {
  it('uuid accepts UUIDs only', () => {
    expect(uuidSchema.safeParse('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11').success).toBe(true);
    expect(uuidSchema.safeParse('123').success).toBe(false);
  });

  it('email is trimmed and lowercased', () => {
    expect(emailSchema.parse('  Amelia.Hart@Example.COM ')).toBe('amelia.hart@example.com');
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it.each([
    ['Passw0rdOK', true],
    ['short1A', false],
    ['allletters', false],
    ['12345678', false],
    ['a'.repeat(73) + '1', false],
  ])('password %s -> %s', (value, expected) => {
    expect(passwordSchema.safeParse(value).success).toBe(expected);
  });

  it.each([
    ['+44 7700 900111', true],
    ['020 7946 0101', true],
    ['abc', false],
    ['12', false],
  ])('phone %s -> %s', (value, expected) => {
    expect(phoneSchema.safeParse(value).success).toBe(expected);
  });

  it('ISO date-time is converted to a Date and rejects other formats', () => {
    const parsed = isoDateTimeSchema.parse('2026-12-01T10:00:00.000Z');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe('2026-12-01T10:00:00.000Z');
    expect(isoDateTimeSchema.parse('2026-12-01T10:00:00+05:00').toISOString()).toBe(
      '2026-12-01T05:00:00.000Z',
    );
    expect(isoDateTimeSchema.safeParse('01/12/2026').success).toBe(false);
  });

  it('pagination applies defaults, coerces strings and caps page size at 50', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
    expect(paginationQuerySchema.safeParse({ pageSize: '51' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});

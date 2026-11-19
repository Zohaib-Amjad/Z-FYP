import { describe, expect, it } from 'vitest';
import { createSlotWindowFormatter } from '../src/utils/formatSlot';

const start = new Date('2030-03-12T05:00:00.000Z');
const end = new Date('2030-03-12T06:00:00.000Z');

describe('createSlotWindowFormatter', () => {
  it('writes slot times in the showrooms’ time zone (Pakistan)', () => {
    const format = createSlotWindowFormatter('Asia/Karachi');
    expect(format(start, end)).toBe('Tuesday, 12 March 2030, 10:00 to 11:00 GMT+5');
  });

  it('labels UTC times as UTC', () => {
    const format = createSlotWindowFormatter('UTC');
    expect(format(start, end)).toBe('Tuesday, 12 March 2030, 05:00 to 06:00 UTC');
  });

  it('moves to the next calendar day when the local time crosses midnight', () => {
    const format = createSlotWindowFormatter('Asia/Karachi');
    expect(format(new Date('2030-03-12T19:30:00.000Z'), new Date('2030-03-12T20:30:00.000Z'))).toBe(
      'Wednesday, 13 March 2030, 00:30 to 01:30 GMT+5',
    );
  });
});

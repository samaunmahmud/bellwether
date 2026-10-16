import { describe, expect, it } from 'vitest';
import { addDays, daysBetween } from '../src/dates';

describe('date helpers', () => {
  it('counts whole days between dates, across months and leap days', () => {
    expect(daysBetween('2026-05-20', '2026-07-01')).toBe(42);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-07-01', '2026-06-30')).toBe(-1);
  });

  it('is unaffected by the switch to British Summer Time', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('adds and subtracts days', () => {
    expect(addDays('2026-04-28', 3)).toBe('2026-05-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

import { describe, expect, it } from 'vitest';
import { isIsoDate, londonToday } from '../src/dates';

describe('isIsoDate', () => {
  it.each(['2026-06-01', '2028-02-29', '2026-12-31'])('accepts %s', (s) => {
    expect(isIsoDate(s)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-6-1', '2026-06-01T00:00', '01/06/2026', ''])(
    'rejects %s',
    (s) => {
      expect(isIsoDate(s)).toBe(false);
    },
  );
});

describe('londonToday', () => {
  it('uses the UK date during British Summer Time, not the UTC date', () => {
    expect(londonToday(new Date('2026-06-01T23:30:00Z'))).toBe('2026-06-02');
  });

  it('matches the UTC date in winter', () => {
    expect(londonToday(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-01');
  });
});

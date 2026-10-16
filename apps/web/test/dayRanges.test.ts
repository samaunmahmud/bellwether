import { dayRanges } from '../src/dates';

const d = (date: string, level: 'MEDIUM' | 'HIGH') => ({ date, level });

describe('dayRanges', () => {
  it('joins consecutive days at the same level into one range', () => {
    expect(
      dayRanges([d('2026-10-16', 'HIGH'), d('2026-10-17', 'HIGH'), d('2026-10-18', 'HIGH')]),
    ).toBe('Fri 16–Sun 18 Oct: High');
  });

  it('starts a new range when the level changes or a day is skipped', () => {
    expect(
      dayRanges([
        d('2026-10-18', 'MEDIUM'),
        d('2026-10-19', 'MEDIUM'),
        d('2026-10-21', 'MEDIUM'),
        d('2026-10-22', 'HIGH'),
      ]),
    ).toBe('Sun 18–Mon 19 Oct: Medium · Wed 21 Oct: Medium · Thu 22 Oct: High');
  });

  it('shows both months when a range crosses into the next one', () => {
    expect(dayRanges([d('2026-10-31', 'HIGH'), d('2026-11-01', 'HIGH')])).toBe(
      'Sat 31 Oct–Sun 1 Nov: High',
    );
  });

  it('handles a single day and no days', () => {
    expect(dayRanges([d('2026-06-10', 'HIGH')])).toBe('Wed 10 Jun: High');
    expect(dayRanges([])).toBe('');
  });
});

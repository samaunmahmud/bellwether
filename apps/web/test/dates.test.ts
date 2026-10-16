import { isOverdue, todayIso } from '../src/dates';

describe('dates', () => {
  it('formats today as an ISO date', () => {
    expect(todayIso(new Date(2026, 5, 3))).toBe('2026-06-03');
  });

  it('marks only past due dates as overdue', () => {
    expect(isOverdue('2026-06-01', '2026-06-02')).toBe(true);
    expect(isOverdue('2026-06-02', '2026-06-02')).toBe(false);
    expect(isOverdue(null, '2026-06-02')).toBe(false);
  });
});

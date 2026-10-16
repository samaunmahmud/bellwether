import { describe, expect, it } from 'vitest';
import { withdrawalEnds, withdrawalStatus } from '../src/domain/records';

describe('withdrawalEnds (FR-6.2)', () => {
  it('is the treatment date plus the withdrawal days', () => {
    expect(withdrawalEnds('2026-06-01', 28)).toBe('2026-06-29');
    expect(withdrawalEnds('2026-12-20', 14)).toBe('2027-01-03');
  });

  it('is null when no period was entered', () => {
    expect(withdrawalEnds('2026-06-01', null)).toBeNull();
  });
});

describe('withdrawalStatus (FR-6.2 acceptance)', () => {
  // Treated 1 June with a 28-day meat withdrawal: ends 29 June,
  // flagged up to and including 28 June, not flagged on 29 June.
  const treatment = { date: '2026-06-01', meatWithdrawalDays: 28, milkWithdrawalDays: null };

  it('is in withdrawal on 28 June', () => {
    expect(withdrawalStatus([treatment], '2026-06-28')).toEqual({
      inWithdrawal: true,
      meatEnds: '2026-06-29',
      milkEnds: null,
    });
  });

  it('is not in withdrawal on 29 June', () => {
    expect(withdrawalStatus([treatment], '2026-06-29')).toEqual({
      inWithdrawal: false,
      meatEnds: null,
      milkEnds: null,
    });
  });

  it('is in withdrawal on the day of treatment', () => {
    expect(withdrawalStatus([treatment], '2026-06-01').inWithdrawal).toBe(true);
  });

  it('is never in withdrawal for a zero-day period', () => {
    expect(
      withdrawalStatus(
        [{ date: '2026-06-01', meatWithdrawalDays: 0, milkWithdrawalDays: 0 }],
        '2026-06-01',
      ).inWithdrawal,
    ).toBe(false);
  });

  it('uses the latest end date across treatments, separately for meat and milk', () => {
    const status = withdrawalStatus(
      [
        { date: '2026-06-01', meatWithdrawalDays: 28, milkWithdrawalDays: 3 },
        { date: '2026-06-10', meatWithdrawalDays: 7, milkWithdrawalDays: 5 },
      ],
      '2026-06-12',
    );
    expect(status).toEqual({ inWithdrawal: true, meatEnds: '2026-06-29', milkEnds: '2026-06-15' });
  });

  it('ignores a treatment recorded for a future date', () => {
    expect(
      withdrawalStatus([{ ...treatment, date: '2026-07-01' }], '2026-06-15').inWithdrawal,
    ).toBe(false);
  });

  it('is not in withdrawal with no treatments', () => {
    expect(withdrawalStatus([], '2026-06-15')).toEqual({
      inWithdrawal: false,
      meatEnds: null,
      milkEnds: null,
    });
  });
});

describe('withdrawalStatus with voided treatments (FR-6.5)', () => {
  it('ignores a voided treatment', () => {
    const voided = {
      date: '2026-06-01',
      meatWithdrawalDays: 28,
      milkWithdrawalDays: null,
      voidedAt: '2026-06-02T09:00:00.000Z',
    };
    expect(withdrawalStatus([voided], '2026-06-10').inWithdrawal).toBe(false);
  });
});

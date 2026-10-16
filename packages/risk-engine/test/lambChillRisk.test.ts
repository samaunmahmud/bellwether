import { describe, expect, it } from 'vitest';
import { calculateChillIndex, chillLevel, lambChillRisk } from '../src/risks/lambChillRisk';
import type { RiskContext } from '../src/types';
import { day } from './helpers';

const lambing = (start: string, end: string, extra: Partial<RiskContext['group']> = {}) => ({
  group: { species: 'sheep' as const, lambingStart: start, lambingEnd: end, ...extra },
});

describe('calculateChillIndex (FR-3.2)', () => {
  // C = (11.7 + 3.1√v)(40 − T) + 481 + 418(1 − e^(−0.04R)), worked by hand:
  it('calm, dry, 10°C: 11.7 × 30 + 481 = 832', () => {
    expect(calculateChillIndex({ tempC: 10, windMs: 0, rainMm: 0 })).toBeCloseTo(832, 6);
  });

  it('4 m/s wind, dry, 5°C: (11.7 + 6.2) × 35 + 481 = 1107.5', () => {
    expect(calculateChillIndex({ tempC: 5, windMs: 4, rainMm: 0 })).toBeCloseTo(1107.5, 6);
  });

  it('1 m/s wind, 10 mm rain, 0°C: 14.8 × 40 + 481 + 418(1 − e^−0.4) ≈ 1210.81', () => {
    expect(calculateChillIndex({ tempC: 0, windMs: 1, rainMm: 10 })).toBeCloseTo(1210.81, 2);
  });

  it('rises with wind and rain, falls with warmth', () => {
    const base = calculateChillIndex({ tempC: 5, windMs: 2, rainMm: 2 });
    expect(calculateChillIndex({ tempC: 5, windMs: 6, rainMm: 2 })).toBeGreaterThan(base);
    expect(calculateChillIndex({ tempC: 5, windMs: 2, rainMm: 12 })).toBeGreaterThan(base);
    expect(calculateChillIndex({ tempC: 12, windMs: 2, rainMm: 2 })).toBeLessThan(base);
  });
});

describe('chillLevel bands (1000 and 1100 kJ/m²/h)', () => {
  it.each([
    [999.9, 'LOW'],
    [1000, 'MEDIUM'],
    [1000.1, 'MEDIUM'],
    [1099.9, 'MEDIUM'],
    [1100, 'HIGH'],
    [1100.1, 'HIGH'],
  ])('%s → %s', (index, level) => {
    expect(chillLevel(index)).toBe(level);
  });
});

describe('lambChillRisk', () => {
  const coldWet = { date: '2026-03-10', tempMeanC: 2, windSpeedMeanMs: 6, precipitationMm: 8 };

  it('names the weather behind the risk', () => {
    const [result] = lambChillRisk.assess([day(coldWet)], lambing('2026-03-01', '2026-03-31'));
    expect(result!.level).toBe('HIGH');
    expect(result!.reason).toMatch(
      /^Chill index \d+ kJ\/m²\/h \(2\.0°C, wind 6\.0 m\/s, 8\.0 mm rain\): newborn lambs at high risk of chilling$/,
    );
  });

  it('is LOW outside the lambing period, including the 3 days after it', () => {
    const days = ['2026-02-28', '2026-03-01', '2026-03-31', '2026-04-03', '2026-04-04'].map(
      (date) => day({ ...coldWet, date }),
    );
    const levels = lambChillRisk
      .assess(days, lambing('2026-03-01', '2026-03-31'))
      .map((r) => [r.date, r.level, r.reason.startsWith('Outside')]);
    expect(levels).toEqual([
      ['2026-02-28', 'LOW', true],
      ['2026-03-01', 'HIGH', false],
      ['2026-03-31', 'HIGH', false],
      ['2026-04-03', 'HIGH', false], // lambs born on the last day are 3 days old
      ['2026-04-04', 'LOW', true],
    ]);
  });

  it('notes when wind data is missing', () => {
    const [result] = lambChillRisk.assess(
      [day({ date: '2026-03-10', tempMeanC: 2 })],
      lambing('2026-03-01', '2026-03-31'),
    );
    expect(result!.reason).toMatch(/no wind data/);
  });

  it('adds a note for a housed flock', () => {
    const [result] = lambChillRisk.assess(
      [day(coldWet)],
      lambing('2026-03-01', '2026-03-31', { housed: true }),
    );
    expect(result!.reason).toMatch(/housed/);
  });

  describe('appliesTo: only sheep whose lambing overlaps the forecast', () => {
    const forecast = [day({ date: '2026-03-10' }), day({ date: '2026-03-23' })];

    it('applies when lambing overlaps', () => {
      expect(lambChillRisk.appliesTo!(lambing('2026-03-20', '2026-04-10'), forecast)).toBe(true);
    });

    it('applies when newborns from a just-finished lambing are still in the forecast', () => {
      expect(lambChillRisk.appliesTo!(lambing('2026-02-01', '2026-03-07'), forecast)).toBe(true);
    });

    it('does not apply when lambing is outside the forecast', () => {
      expect(lambChillRisk.appliesTo!(lambing('2026-04-01', '2026-04-30'), forecast)).toBe(false);
      expect(lambChillRisk.appliesTo!(lambing('2026-02-01', '2026-03-06'), forecast)).toBe(false);
    });

    it('does not apply without lambing dates, or to cattle', () => {
      expect(lambChillRisk.appliesTo!({ group: { species: 'sheep' } }, forecast)).toBe(false);
      expect(
        lambChillRisk.appliesTo!(
          { group: { species: 'cattle', lambingStart: '2026-03-01', lambingEnd: '2026-03-31' } },
          forecast,
        ),
      ).toBe(false);
    });
  });
});

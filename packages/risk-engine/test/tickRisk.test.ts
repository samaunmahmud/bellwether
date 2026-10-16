import { describe, expect, it } from 'vitest';
import { tickRisk } from '../src/risks/tickRisk';
import { day } from './helpers';

const assessOne = (overrides: Parameters<typeof day>[0], ctx = {}) =>
  tickRisk.assess([day(overrides)], ctx)[0]!;

describe('tickRisk', () => {
  describe('cold threshold (mean < 5°C)', () => {
    it('is LOW just below 5°C', () => {
      expect(assessOne({ tempMeanC: 4.9, humidityMeanPct: 95 }).level).toBe('LOW');
    });

    it('is not LOW from cold at exactly 5°C', () => {
      expect(assessOne({ tempMeanC: 5, humidityMeanPct: 95 }).level).toBe('MEDIUM');
    });
  });

  describe('mild and humid (mean >= 7°C and humidity >= 80%)', () => {
    it('is HIGH exactly on both thresholds', () => {
      const result = assessOne({ tempMeanC: 7, humidityMeanPct: 80 });
      expect(result.level).toBe('HIGH');
      expect(result.reason).toMatch(/mild and humid/i);
    });

    it('is MEDIUM just below the temperature threshold', () => {
      expect(assessOne({ tempMeanC: 6.9, humidityMeanPct: 90 }).level).toBe('MEDIUM');
    });

    it('is MEDIUM just below the humidity threshold', () => {
      expect(assessOne({ tempMeanC: 12, humidityMeanPct: 79.9 }).level).toBe('MEDIUM');
    });
  });

  describe('hot and dry (max >= 28°C and humidity < 60%)', () => {
    it('is LOW exactly on the heat threshold when dry', () => {
      const result = assessOne({ tempMeanC: 22, tempMaxC: 28, humidityMeanPct: 59 });
      expect(result.level).toBe('LOW');
      expect(result.reason).toMatch(/hot and dry/i);
    });

    it('is not treated as dry at exactly 60% humidity', () => {
      expect(assessOne({ tempMeanC: 22, tempMaxC: 30, humidityMeanPct: 60 }).level).toBe('MEDIUM');
    });

    it('is not treated as hot just below 28°C', () => {
      expect(assessOne({ tempMeanC: 22, tempMaxC: 27.9, humidityMeanPct: 50 }).level).toBe(
        'MEDIUM',
      );
    });
  });

  describe('high-exposure habitat', () => {
    it('raises LOW to MEDIUM and explains why', () => {
      const result = assessOne({ tempMeanC: 3 }, { highExposureHabitat: true });
      expect(result.level).toBe('MEDIUM');
      expect(result.reason).toMatch(/long grass or woodland/i);
    });

    it('raises MEDIUM to HIGH', () => {
      expect(
        assessOne({ tempMeanC: 10, humidityMeanPct: 60 }, { highExposureHabitat: true }).level,
      ).toBe('HIGH');
    });

    it('leaves HIGH as HIGH without changing the reason', () => {
      const result = assessOne(
        { tempMeanC: 10, humidityMeanPct: 90 },
        { highExposureHabitat: true },
      );
      expect(result.level).toBe('HIGH');
      expect(result.reason).not.toMatch(/long grass/i);
    });
  });

  it('returns one result per day, keeping dates, with a reason and score in range', () => {
    const days = [day({ date: '2026-06-01' }), day({ date: '2026-06-02', tempMeanC: 2 })];
    const results = tickRisk.assess(days);
    expect(results.map((r) => r.date)).toEqual(['2026-06-01', '2026-06-02']);
    for (const r of results) {
      expect(r.reason.length).toBeGreaterThan(0);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

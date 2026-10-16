import { describe, expect, it } from 'vitest';
import { sheepBlowflyRisk } from '../src/risks/sheepBlowflyRisk';
import { day } from './helpers';

const assessOne = (overrides: Parameters<typeof day>[0]) =>
  sheepBlowflyRisk.assess([day(overrides)])[0]!;

describe('sheepBlowflyRisk', () => {
  describe('cold threshold (mean < 9°C)', () => {
    it('is LOW just below 9°C', () => {
      expect(assessOne({ tempMeanC: 8.9 }).level).toBe('LOW');
    });

    it('is MEDIUM at exactly 9°C', () => {
      expect(assessOne({ tempMeanC: 9, humidityMeanPct: 50 }).level).toBe('MEDIUM');
    });
  });

  describe('warm and humid (mean >= 15°C and humidity >= 70%)', () => {
    it('is HIGH exactly on both thresholds', () => {
      expect(assessOne({ tempMeanC: 15, humidityMeanPct: 70 }).level).toBe('HIGH');
    });

    it('is MEDIUM just below the temperature threshold', () => {
      expect(assessOne({ tempMeanC: 14.9, humidityMeanPct: 90 }).level).toBe('MEDIUM');
    });

    it('is MEDIUM just below the humidity threshold', () => {
      expect(assessOne({ tempMeanC: 18, humidityMeanPct: 69.9 }).level).toBe('MEDIUM');
    });
  });

  describe('rain the day before (>= 2mm)', () => {
    it('raises a mild day to HIGH and explains why', () => {
      const [, today] = sheepBlowflyRisk.assess([
        day({ date: '2026-06-01', precipitationMm: 2 }),
        day({ date: '2026-06-02', tempMeanC: 12, humidityMeanPct: 50 }),
      ]);
      expect(today!.level).toBe('HIGH');
      expect(today!.reason).toMatch(/rain the day before/i);
    });

    it('does not raise when the previous day had just under 2mm', () => {
      const [, today] = sheepBlowflyRisk.assess([
        day({ precipitationMm: 1.9 }),
        day({ tempMeanC: 12, humidityMeanPct: 50 }),
      ]);
      expect(today!.level).toBe('MEDIUM');
    });

    it('does not raise a cold day', () => {
      const [, today] = sheepBlowflyRisk.assess([
        day({ precipitationMm: 10 }),
        day({ tempMeanC: 5 }),
      ]);
      expect(today!.level).toBe('LOW');
    });

    it('leaves HIGH as HIGH without adding the rain note', () => {
      const [, today] = sheepBlowflyRisk.assess([
        day({ precipitationMm: 10 }),
        day({ tempMeanC: 18, humidityMeanPct: 80 }),
      ]);
      expect(today!.level).toBe('HIGH');
      expect(today!.reason).not.toMatch(/rain/i);
    });

    it('never raises the first day (no previous day)', () => {
      expect(assessOne({ tempMeanC: 12, humidityMeanPct: 50, precipitationMm: 20 }).level).toBe(
        'MEDIUM',
      );
    });
  });
});

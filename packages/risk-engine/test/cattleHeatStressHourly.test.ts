import { describe, expect, it } from 'vitest';
import { calculateTHI, cattleHeatStressRisk } from '../src/risks/cattleHeatStressRisk';
import type { HourlyWeather } from '../src/types';
import { day } from './helpers';

// At 100% humidity THI = 1.8T + 32, which makes target values easy to hit.
const SATURATED = 100;
const tempForThi = (thi: number) => (thi - 32) / 1.8;

function hour(h: number, thi: number): HourlyWeather {
  return {
    time: `2026-07-01T${String(h).padStart(2, '0')}:00`,
    tempC: tempForThi(thi),
    humidityPct: SATURATED,
    windSpeedMs: 2,
    precipitationMm: 0,
  };
}

/** A day whose hours have the given THI values, starting at midnight. */
const dayWithHourlyThi = (values: number[]) =>
  day({
    date: '2026-07-01',
    tempMaxC: 10,
    humidityMeanPct: 50,
    hours: values.map((v, h) => hour(h, v)),
  });

const assess = (values: number[], housed = false) =>
  cattleHeatStressRisk.assess([dayWithHourlyThi(values)], {
    group: { species: 'cattle', housed },
  })[0]!;

describe('cattleHeatStressRisk with hourly data (FR-3.1)', () => {
  it('uses the hourly peak, not the daily maximum temperature', () => {
    // The daily fields alone would say LOW (10°C max).
    const values = Array(24).fill(60);
    values[15] = 75.3;
    const result = assess(values);
    expect(result.level).toBe('HIGH');
    expect(result.reason).toBe(
      'Peak THI 75.3 around 3pm; 1 hour at or above 72: heat stress likely',
    );
  });

  it('counts the hours at or above 72', () => {
    const values = [60, 72, 73, 74, 75, 76, 70, 60];
    expect(assess(values).reason).toMatch(/; 5 hours at or above 72/);
  });

  describe('hour-count boundary at 72', () => {
    it('counts an hour exactly on 72', () => {
      expect(assess([60, 72]).reason).toMatch(/1 hour at or above 72/);
    });

    it('does not count an hour just below, at 71.9', () => {
      const result = assess([60, 71.9]);
      expect(result.level).toBe('MEDIUM');
      expect(result.reason).not.toMatch(/at or above/);
    });

    it('counts an hour just above, at 72.1', () => {
      expect(assess([60, 72.1]).reason).toMatch(/1 hour at or above 72/);
    });
  });

  describe('level boundaries use the peak', () => {
    it('is LOW just below 68', () => {
      expect(assess([60, 67.9]).level).toBe('LOW');
    });

    it('is MEDIUM on 68', () => {
      expect(assess([60, 68]).level).toBe('MEDIUM');
    });

    it('is MEDIUM just below 72 and HIGH on 72', () => {
      expect(assess([71.9]).level).toBe('MEDIUM');
      expect(assess([72]).level).toBe('HIGH');
    });
  });

  it('says when the peak happens', () => {
    expect(assess([69, 60]).reason).toBe('Peak THI 69.0 around 12am: mild heat stress possible');
    const noon = Array(13).fill(60);
    noon[12] = 69;
    expect(assess(noon).reason).toMatch(/around 12pm/);
  });

  it('adds a note for housed cattle', () => {
    expect(assess([75], true).reason).toMatch(
      /housed: shed conditions may differ from outdoor weather/,
    );
    expect(assess([75], false).reason).not.toMatch(/housed/);
  });

  it('also adds the housed note when only daily data is available', () => {
    const [result] = cattleHeatStressRisk.assess([day({ tempMaxC: 30, humidityMeanPct: 70 })], {
      group: { species: 'cattle', housed: true },
    });
    expect(result!.reason).toMatch(/housed/);
  });

  it('scores from the hourly peak', () => {
    const low = assess([60]).score;
    const high = assess([80]).score;
    expect(high).toBeGreaterThan(low);
    expect(calculateTHI(tempForThi(80), SATURATED)).toBeCloseTo(80);
  });
});

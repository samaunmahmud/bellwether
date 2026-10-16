import { describe, expect, it } from 'vitest';
import {
  flukeLevel,
  flukeSeasonYear,
  liverFlukeRisk,
  monthlyFlukeValue,
  seasonFlukeIndex,
} from '../src/risks/liverFlukeRisk';
import type { DailyWeather } from '../src/types';
import { day } from './helpers';

/** Every day of a month, with rain on the first `rainDays` days, totalling the given amounts. */
function month(
  yearMonth: string,
  { rainDays, rainMm, petMm }: { rainDays: number; rainMm: number; petMm: number },
): DailyWeather[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const length = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return Array.from({ length }, (_, i) =>
    day({
      date: `${yearMonth}-${String(i + 1).padStart(2, '0')}`,
      precipitationMm: i < rainDays ? rainMm / rainDays : 0,
      et0Mm: petMm / length,
    }),
  );
}

const WET = { rainDays: 15, rainMm: 100, petMm: 50 }; // capped at 100 (50 in May/Oct)
const MIXED = { rainDays: 10, rainMm: 60, petMm: 85 }; // ≈ 40.16

describe('monthlyFlukeValue (FR-3.3)', () => {
  // Mt = n × ((R − P) in inches + 5), worked by hand:
  it('10 rain days, 60 mm rain, 85 mm evaporation: 10 × (−25/25.4 + 5) ≈ 40.16', () => {
    expect(monthlyFlukeValue({ month: 7, ...MIXED })).toBeCloseTo(40.157, 3);
  });

  it('caps a wet month at 100', () => {
    // 15 × (50/25.4 + 5) ≈ 104.5
    expect(monthlyFlukeValue({ month: 7, ...WET })).toBe(100);
  });

  it('caps May and October at 50', () => {
    expect(monthlyFlukeValue({ month: 5, ...WET })).toBe(50);
    expect(monthlyFlukeValue({ month: 10, ...WET })).toBe(50);
  });

  it('never goes below 0 in a dry month', () => {
    expect(monthlyFlukeValue({ month: 7, rainDays: 5, rainMm: 10, petMm: 200 })).toBe(0);
  });
});

describe('flukeLevel bands (300 and 400)', () => {
  it.each([
    [299.9, 'LOW'],
    [300, 'MEDIUM'],
    [300.1, 'MEDIUM'],
    [399.9, 'MEDIUM'],
    [400, 'MEDIUM'],
    [400.1, 'HIGH'],
  ])('%s → %s', (index, level) => {
    expect(flukeLevel(index)).toBe(level);
  });
});

describe('flukeSeasonYear', () => {
  it('uses this year from June, once May is complete', () => {
    expect(flukeSeasonYear('2026-06-01')).toBe(2026);
    expect(flukeSeasonYear('2026-12-15')).toBe(2026);
  });

  it('uses last year until then', () => {
    expect(flukeSeasonYear('2026-05-31')).toBe(2025);
    expect(flukeSeasonYear('2026-01-10')).toBe(2025);
  });
});

describe('liverFlukeRisk.historyRange', () => {
  it('asks for May up to the day before the forecast, in season', () => {
    expect(liverFlukeRisk.historyRange!('2026-08-15')).toEqual({
      start: '2026-05-01',
      end: '2026-08-14',
    });
  });

  it('asks for the whole of last season in winter and spring', () => {
    expect(liverFlukeRisk.historyRange!('2026-02-01')).toEqual({
      start: '2025-05-01',
      end: '2025-10-31',
    });
  });
});

describe('seasonFlukeIndex', () => {
  it('sums complete season months only', () => {
    const history = [
      ...month('2026-05', WET), // 50
      ...month('2026-06', WET), // 100
      ...month('2026-07', MIXED), // ≈ 40.16
      ...month('2026-08', WET).slice(0, 20), // incomplete: ignored
    ];
    const result = seasonFlukeIndex(history, 2026);
    expect(result.index).toBeCloseTo(190.157, 3);
    expect(result.months).toEqual(['May', 'Jun', 'Jul']);
    expect(result.complete).toBe(false);
    expect(result.rainDays).toBe(40);
    expect(result.rainMm).toBeCloseTo(260, 6);
  });

  it('ignores months outside May–October and other years', () => {
    const history = [...month('2026-04', WET), ...month('2025-06', WET), ...month('2026-11', WET)];
    expect(seasonFlukeIndex(history, 2026).months).toEqual([]);
  });

  it('treats a month with missing evaporation data as incomplete', () => {
    const june = month('2026-06', WET).map((d, i) => (i === 3 ? { ...d, et0Mm: undefined } : d));
    expect(seasonFlukeIndex(june, 2026).months).toEqual([]);
  });

  it('marks a full May–October season as complete', () => {
    const history = ['05', '06', '07', '08', '09', '10'].flatMap((m) => month(`2025-${m}`, WET));
    const result = seasonFlukeIndex(history, 2025);
    expect(result.index).toBe(500); // 50 + 4 × 100 + 50
    expect(result.complete).toBe(true);
  });
});

describe('liverFlukeRisk.assess', () => {
  const forecast = [day({ date: '2026-08-15' }), day({ date: '2026-08-16' })];
  const wetSummer = [
    ...month('2026-05', WET),
    ...month('2026-06', WET),
    ...month('2026-07', WET),
    ...month('2026-08', WET).slice(0, 14),
  ]; // 50 + 100 + 100 = 250 so far

  it('gives every forecast day the same season-level result, naming the weather', () => {
    const results = liverFlukeRisk.assess(forecast, {
      group: { species: 'sheep' },
      history: wetSummer,
    });
    expect(results).toHaveLength(2);
    expect(results[0]!.level).toBe('LOW');
    expect(results[0]!.reason).toBe(
      'Fluke season index 250 from May–Jul 2026 weather so far ' +
        '(300 mm rain on 45 days, 150 mm evaporation): low fluke risk so far this season',
    );
    expect(results[1]).toEqual({ ...results[0], date: '2026-08-16' });
  });

  it('is HIGH after a wet season', () => {
    const history = ['05', '06', '07', '08', '09', '10'].flatMap((m) => month(`2025-${m}`, WET));
    const [result] = liverFlukeRisk.assess([day({ date: '2026-01-10' })], { history });
    expect(result!.level).toBe('HIGH');
    expect(result!.reason).toMatch(/^Fluke season index 500 from May–Oct 2025 weather \(/);
    expect(result!.reason).toMatch(/high fluke risk this season$/);
  });

  it('names a single month on its own', () => {
    const [result] = liverFlukeRisk.assess([day({ date: '2026-07-02' })], {
      history: [...month('2026-05', MIXED), ...month('2026-06', WET).slice(0, 10)],
    });
    expect(result!.reason).toMatch(/^Fluke season index 40 from May 2026 weather so far/);
  });

  it('returns nothing for no forecast days', () => {
    expect(liverFlukeRisk.assess([], { history: [] })).toEqual([]);
  });

  it('says when there is not enough past weather', () => {
    const [result] = liverFlukeRisk.assess(forecast, {});
    expect(result!.level).toBe('LOW');
    expect(result!.reason).toBe('Not enough past weather to estimate the fluke season');
  });

  it('applies only when there is at least one complete season month', () => {
    expect(liverFlukeRisk.appliesTo!({ history: wetSummer }, forecast)).toBe(true);
    expect(liverFlukeRisk.appliesTo!({ history: [] }, forecast)).toBe(false);
    // Some days, but no complete month yet
    expect(
      liverFlukeRisk.appliesTo!({ history: month('2026-05', WET).slice(0, 20) }, forecast),
    ).toBe(false);
    expect(liverFlukeRisk.appliesTo!({}, forecast)).toBe(false);
  });
});

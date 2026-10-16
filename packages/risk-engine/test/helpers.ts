import type { DailyWeather } from '../src/types';

/** Build a day of weather with sensible defaults, overriding only what a test cares about. */
export function day(overrides: Partial<DailyWeather> = {}): DailyWeather {
  return {
    date: '2026-06-01',
    tempMeanC: 12,
    tempMaxC: 16,
    tempMinC: 8,
    humidityMeanPct: 70,
    precipitationMm: 0,
    ...overrides,
  };
}

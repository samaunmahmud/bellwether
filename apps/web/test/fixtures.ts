import type { Forecast, RiskForecast } from '../src/types';

export const tickForecast: RiskForecast = {
  riskId: 'tick',
  name: 'Tick activity',
  category: 'PET',
  animals: ['dog', 'cat'],
  days: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    level: i === 0 ? 'HIGH' : i % 2 ? 'MEDIUM' : 'LOW',
    score: i === 0 ? 85 : i % 2 ? 50 : 15,
    reason: i === 0 ? 'Mild and humid: ticks likely active' : 'Some tick activity possible',
  })),
};

export const petForecast: Forecast = {
  location: { postcode: 'UB8 3PH', region: 'London' },
  generatedAt: '2026-06-01T09:00:00Z',
  risks: [tickForecast],
};

/** Adds the __typename fields Apollo's cache expects, so mocked responses match real ones. */
export function withTypenames(f: Forecast) {
  return {
    __typename: 'Forecast',
    ...f,
    location: { __typename: 'Location', ...f.location },
    risks: f.risks.map((r) => ({
      __typename: 'RiskForecast',
      ...r,
      days: r.days.map((d) => ({ __typename: 'DailyRisk', ...d })),
    })),
  };
}

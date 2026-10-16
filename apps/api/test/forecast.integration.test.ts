import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache/cache';
import type { WeatherClient } from '../src/clients/weatherClient';
import { brokenCache, buildTestApp, fakeDays, fakeWeather } from './fakes';

const FORECAST = /* GraphQL */ `
  query Forecast($postcode: String!, $category: AnimalCategory!, $exposure: Boolean) {
    forecast(postcode: $postcode, category: $category, highExposureHabitat: $exposure) {
      location {
        postcode
        region
      }
      generatedAt
      risks {
        riskId
        category
        animals
        days {
          date
          level
          score
          reason
        }
      }
    }
  }
`;

interface ForecastData {
  forecast: {
    location: { postcode: string; region: string };
    generatedAt: string;
    risks: Array<{
      riskId: string;
      category: string;
      animals: string[];
      days: Array<{ date: string; level: string; score: number; reason: string }>;
    }>;
  };
}

describe('forecast query', () => {
  it('returns 14 days of pet risks for a valid postcode (normalised)', async () => {
    const { gql } = buildTestApp();
    const res = await gql<ForecastData>(FORECAST, { postcode: 'ub83ph', category: 'PET' });

    expect(res.errors).toBeUndefined();
    const f = res.data!.forecast;
    expect(f.location).toEqual({ postcode: 'UB8 3PH', region: 'London' });
    expect(f.generatedAt).toBe('2026-06-01T09:00:00.000Z');
    expect(f.risks.map((r) => r.riskId)).toEqual(['tick', 'dog-heatstroke']);
    expect(f.risks.every((r) => r.category === 'PET')).toBe(true);
    expect(f.risks[0]!.days).toHaveLength(14);
    // Fake weather is mild (12°C) and humid (85%) → ticks HIGH
    expect(f.risks[0]!.days[0]).toMatchObject({
      level: 'HIGH',
      reason: 'Mild and humid: ticks likely active',
    });
  });

  it('returns farm risks for the FARM category', async () => {
    const { gql } = buildTestApp();
    const res = await gql<ForecastData>(FORECAST, { postcode: 'UB8 3PH', category: 'FARM' });
    expect(res.data!.forecast.risks.map((r) => r.riskId)).toEqual([
      'cattle-heat-stress',
      'sheep-blowfly',
    ]);
  });

  it('passes the long grass / woodland option through to the tick module', async () => {
    const { gql } = buildTestApp({
      weather: fakeWeather(fakeDays(14, { humidityMeanPct: 60 })).client,
    });
    const res = await gql<ForecastData>(FORECAST, {
      postcode: 'UB8 3PH',
      category: 'PET',
      exposure: true,
    });
    const tickDay = res.data!.forecast.risks[0]!.days[0]!;
    expect(tickDay.level).toBe('HIGH');
    expect(tickDay.reason).toMatch(/long grass or woodland/);
  });

  it('caches postcode and weather lookups', async () => {
    const { gql, postcodes, weather } = buildTestApp({ cache: new MemoryCache() });
    await gql(FORECAST, { postcode: 'UB8 3PH', category: 'PET' });
    await gql(FORECAST, { postcode: 'UB8 3PH', category: 'FARM' });
    expect(postcodes.calls).toHaveLength(1);
    expect(weather.calls).toEqual([[51.53, -0.47]]); // rounded to 2dp
  });

  describe('errors', () => {
    it('rejects an invalid postcode with INVALID_POSTCODE', async () => {
      const { gql, postcodes } = buildTestApp();
      const res = await gql(FORECAST, { postcode: 'not a postcode', category: 'PET' });
      expect(res.errors?.[0]?.extensions?.code).toBe('INVALID_POSTCODE');
      expect(postcodes.calls).toHaveLength(0);
    });

    it('returns POSTCODE_NOT_FOUND for a valid-looking unknown postcode', async () => {
      const { gql } = buildTestApp();
      const res = await gql(FORECAST, { postcode: 'ZZ1 1ZZ', category: 'PET' });
      expect(res.errors?.[0]?.extensions?.code).toBe('POSTCODE_NOT_FOUND');
    });

    it('returns UPSTREAM_UNAVAILABLE when the weather API fails, without crashing', async () => {
      const failing: WeatherClient = {
        getDailyForecast: async () => {
          throw new Error('Open-Meteo responded 503');
        },
      };
      const { gql } = buildTestApp({ weather: failing });
      const res = await gql(FORECAST, { postcode: 'UB8 3PH', category: 'PET' });
      expect(res.errors?.[0]?.extensions?.code).toBe('UPSTREAM_UNAVAILABLE');
      expect(res.errors?.[0]?.message).toMatch(/weather forecast is unavailable/i);
    });

    it('returns UPSTREAM_UNAVAILABLE when the postcode API fails', async () => {
      const { gql } = buildTestApp({
        postcodes: {
          lookup: async () => {
            throw new Error('down');
          },
        },
      });
      const res = await gql(FORECAST, { postcode: 'UB8 3PH', category: 'PET' });
      expect(res.errors?.[0]?.extensions?.code).toBe('UPSTREAM_UNAVAILABLE');
    });

    it('still works when Redis (the cache) is down', async () => {
      const { gql } = buildTestApp({ cache: brokenCache });
      const res = await gql<ForecastData>(FORECAST, { postcode: 'UB8 3PH', category: 'PET' });
      expect(res.errors).toBeUndefined();
      expect(res.data!.forecast.risks).toHaveLength(2);
    });
  });
});

import type { DailyWeather } from '@animalcast/risk-engine';
import { MemoryCache, type Cache } from '../src/cache/cache';
import type { Location, PostcodeClient } from '../src/clients/postcodesClient';
import type { WeatherClient } from '../src/clients/weatherClient';
import { createApp } from '../src/app';
import { silentLogger } from '../src/logger';
import { InMemoryAnimalRepository } from '../src/repositories/animalRepository';

export const UXBRIDGE: Location = {
  postcode: 'UB8 3PH',
  latitude: 51.5326,
  longitude: -0.4729,
  region: 'London',
};

export function fakeDays(count = 14, overrides: Partial<DailyWeather> = {}): DailyWeather[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    tempMeanC: 12,
    tempMaxC: 17,
    tempMinC: 8,
    humidityMeanPct: 85,
    precipitationMm: 0,
    ...overrides,
  }));
}

export function fakePostcodes(known: Location[] = [UXBRIDGE]) {
  const calls: string[] = [];
  const client: PostcodeClient = {
    async lookup(postcode) {
      calls.push(postcode);
      return known.find((l) => l.postcode === postcode) ?? null;
    },
  };
  return { client, calls };
}

export function fakeWeather(days: DailyWeather[] = fakeDays()) {
  const calls: Array<[number, number]> = [];
  const client: WeatherClient = {
    async getDailyForecast(lat, lon) {
      calls.push([lat, lon]);
      return days;
    },
  };
  return { client, calls };
}

export const brokenCache: Cache = {
  get: async () => {
    throw new Error('ECONNREFUSED');
  },
  set: async () => {
    throw new Error('ECONNREFUSED');
  },
};

export function buildTestApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  const postcodes = fakePostcodes();
  const weather = fakeWeather();
  const app = createApp({
    postcodes: postcodes.client,
    weather: weather.client,
    cache: new MemoryCache(),
    animals: new InMemoryAnimalRepository(),
    logger: silentLogger,
    now: () => new Date('2026-06-01T09:00:00Z'),
    ...overrides,
  });

  async function gql<T = Record<string, unknown>>(
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    const res = await app.fetch('http://test/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return (await res.json()) as {
      data?: T;
      errors?: Array<{ message: string; extensions?: { code?: string } }>;
    };
  }

  return { app, gql, postcodes, weather };
}

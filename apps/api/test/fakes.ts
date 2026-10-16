import type { DailyWeather } from '@bellwether/risk-engine';
import { createScryptHasher } from '../src/auth/passwords';
import { MemoryCache, type Cache } from '../src/cache/cache';
import type { Location, PostcodeClient } from '../src/clients/postcodesClient';
import type { WeatherClient } from '../src/clients/weatherClient';
import { createApp } from '../src/app';
import { silentLogger } from '../src/logger';
import { InMemoryAnimalRepository } from '../src/repositories/animalRepository';
import { InMemoryFarmRepository } from '../src/repositories/farmRepository';
import { InMemoryUserRepository } from '../src/repositories/userRepository';

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

export type GqlResult<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

export type Gql = <T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
) => Promise<GqlResult<T>>;

export const TEST_PASSWORD = 'correct horse battery';

const SIGN_UP = /* GraphQL */ `
  mutation ($email: String!, $password: String!) {
    signUp(email: $email, password: $password) {
      id
    }
  }
`;

export function buildTestApp(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  const postcodes = fakePostcodes();
  const weather = fakeWeather();
  const app = createApp({
    postcodes: postcodes.client,
    weather: weather.client,
    cache: new MemoryCache(),
    animals: new InMemoryAnimalRepository(),
    farms: new InMemoryFarmRepository(),
    users: new InMemoryUserRepository(),
    // Low scrypt cost keeps tests fast
    hasher: createScryptHasher(2 ** 10),
    logger: silentLogger,
    now: () => new Date('2026-06-01T09:00:00Z'),
    ...overrides,
  });

  /** Sends a GraphQL request, optionally with a session cookie. Returns the body and response. */
  async function send<T>(
    query: string,
    variables: Record<string, unknown> = {},
    cookie?: string,
  ): Promise<{ body: GqlResult<T>; response: Response }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (cookie) headers.cookie = cookie;
    const response = await app.fetch('http://test/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    return { body: (await response.json()) as GqlResult<T>, response };
  }

  /** A client with the given session cookie, or an anonymous one. */
  function withCookie(cookie?: string): Gql {
    return async <T = Record<string, unknown>>(
      query: string,
      variables: Record<string, unknown> = {},
    ) => (await send<T>(query, variables, cookie)).body;
  }

  /** An anonymous client. */
  const gql = withCookie();

  /** Signs up a new user and returns a client that is logged in as them. */
  async function signedIn(email = 'ann@example.com'): Promise<Gql> {
    const { body, response } = await send(SIGN_UP, { email, password: TEST_PASSWORD });
    if (body.errors) throw new Error(`sign-up failed: ${body.errors[0]!.message}`);
    const setCookie = response.headers.get('set-cookie') ?? '';
    return withCookie(setCookie.split(';')[0]!);
  }

  return { app, gql, send, withCookie, signedIn, postcodes, weather };
}

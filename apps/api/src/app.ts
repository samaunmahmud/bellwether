import { createSchema, createYoga, type Plugin } from 'graphql-yoga';
import type { GraphQLContext } from './auth/context';
import { readCookie, SESSION_COOKIE } from './auth/cookies';
import { createScryptHasher, type PasswordHasher } from './auth/passwords';
import type { Cache } from './cache/cache';
import type { PostcodeClient } from './clients/postcodesClient';
import type { WeatherClient } from './clients/weatherClient';
import type { Logger } from './logger';
import type { AnimalRepository } from './repositories/animalRepository';
import type { FarmRepository } from './repositories/farmRepository';
import type { RecordsRepository } from './repositories/recordsRepository';
import type { UserRepository } from './repositories/userRepository';
import { createResolvers } from './resolvers';
import { createAuthResolvers } from './resolvers/auth';
import { createFarmResolvers } from './resolvers/farms';
import { createRecordsResolvers } from './resolvers/records';
import { typeDefs } from './schema/typeDefs';
import { createAuthService } from './services/authService';
import { createFarmService } from './services/farmService';
import { createForecastService } from './services/forecastService';
import { createLocationService } from './services/locationService';
import { createRecordsService } from './services/recordsService';

export interface AppDeps {
  postcodes: PostcodeClient;
  weather: WeatherClient;
  cache: Cache;
  animals: AnimalRepository;
  farms: FarmRepository;
  records: RecordsRepository;
  users: UserRepository;
  logger: Logger;
  hasher?: PasswordHasher;
  /** Adds `Secure` to the session cookie. On in production (HTTPS). */
  secureCookies?: boolean;
  now?: () => Date;
}

/** Builds the GraphQL app from its dependencies, so tests can swap in fakes. */
export function createApp(deps: AppDeps) {
  const locations = createLocationService(deps);
  const forecastService = createForecastService({ ...deps, locations });
  const farmService = createFarmService({ repo: deps.farms, locations, now: deps.now });
  const recordsService = createRecordsService({
    records: deps.records,
    farmService,
    now: deps.now,
  });
  const authService = createAuthService({
    users: deps.users,
    hasher: deps.hasher ?? createScryptHasher(),
    now: deps.now,
  });
  const resolvers = [
    createResolvers({ forecastService, animals: deps.animals }),
    createFarmResolvers({ farmService, forecastService }),
    createAuthResolvers({ authService, secureCookies: deps.secureCookies ?? false }),
    createRecordsResolvers({ farmService, recordsService }),
  ];

  // Cookies set by resolvers, added to the matching response by the plugin below.
  const pendingCookies = new WeakMap<Request, string[]>();
  const setCookies: Plugin = {
    onResponse({ request, response }) {
      for (const cookie of pendingCookies.get(request) ?? []) {
        response.headers.append('set-cookie', cookie);
      }
    },
  };

  return createYoga({
    schema: createSchema<GraphQLContext>({ typeDefs, resolvers }),
    graphqlEndpoint: '/graphql',
    logging: false,
    plugins: [setCookies],
    context: async ({ request }) => {
      const sessionToken = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
      return {
        user: await authService.userForToken(sessionToken),
        sessionToken,
        setCookie: (cookie: string) => {
          pendingCookies.set(request, [...(pendingCookies.get(request) ?? []), cookie]);
        },
      };
    },
  });
}

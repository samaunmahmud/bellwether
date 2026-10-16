import { createSchema, createYoga, type Plugin } from 'graphql-yoga';
import type { GraphQLContext } from './auth/context';
import { readCookie, SESSION_COOKIE } from './auth/cookies';
import { createScryptHasher, type PasswordHasher } from './auth/passwords';
import type { Cache } from './cache/cache';
import type { PostcodeClient } from './clients/postcodesClient';
import type { WeatherClient } from './clients/weatherClient';
import type { EmailSender } from './email/emailSender';
import type { Logger } from './logger';
import type { AnimalRepository } from './repositories/animalRepository';
import type { BriefingRepository, TaskRepository } from './repositories/briefingRepository';
import type { FarmRepository } from './repositories/farmRepository';
import type { RecordsRepository } from './repositories/recordsRepository';
import type { UserRepository } from './repositories/userRepository';
import { createResolvers } from './resolvers';
import { createAuthResolvers } from './resolvers/auth';
import { createBriefingResolvers } from './resolvers/briefing';
import { createFarmResolvers } from './resolvers/farms';
import { createRecordsResolvers } from './resolvers/records';
import { typeDefs } from './schema/typeDefs';
import { createAuthService } from './services/authService';
import { createBriefingService } from './services/briefingService';
import { createFarmService } from './services/farmService';
import { createForecastService } from './services/forecastService';
import { createLocationService } from './services/locationService';
import { createPetService } from './services/petService';
import { createRecordsService } from './services/recordsService';
import { createTaskService } from './services/taskService';

export interface AppDeps {
  postcodes: PostcodeClient;
  weather: WeatherClient;
  cache: Cache;
  animals: AnimalRepository;
  farms: FarmRepository;
  records: RecordsRepository;
  tasks: TaskRepository;
  briefings: BriefingRepository;
  users: UserRepository;
  email: EmailSender;
  logger: Logger;
  /** Public URL of the web app, for links in emails */
  appUrl: string;
  hasher?: PasswordHasher;
  /** Adds `Secure` to the session cookie. On in production (HTTPS). */
  secureCookies?: boolean;
  now?: () => Date;
}

/** Builds every service from the dependencies. Shared by the GraphQL app and the briefing job. */
export function createServices(deps: AppDeps) {
  const locations = createLocationService(deps);
  const forecastService = createForecastService({ ...deps, locations });
  const petService = createPetService({ animals: deps.animals, locations, forecastService });
  const farmService = createFarmService({ repo: deps.farms, locations, now: deps.now });
  const recordsService = createRecordsService({
    records: deps.records,
    farmService,
    now: deps.now,
  });
  const taskService = createTaskService({ tasks: deps.tasks, farmService, now: deps.now });
  const briefingService = createBriefingService({
    farmService,
    forecastService,
    briefings: deps.briefings,
    logger: deps.logger,
    now: deps.now,
  });
  const authService = createAuthService({
    users: deps.users,
    hasher: deps.hasher ?? createScryptHasher(),
    now: deps.now,
  });
  return {
    forecastService,
    petService,
    farmService,
    recordsService,
    taskService,
    briefingService,
    authService,
  };
}

export type AppServices = ReturnType<typeof createServices>;

/** Builds the GraphQL app from its dependencies, so tests can swap in fakes. */
export function createApp(deps: AppDeps, services: AppServices = createServices(deps)) {
  const { forecastService, farmService, recordsService, taskService, briefingService } = services;
  const resolvers = [
    createResolvers({ forecastService, petService: services.petService }),
    createFarmResolvers({ farmService, forecastService }),
    createAuthResolvers({
      authService: services.authService,
      secureCookies: deps.secureCookies ?? false,
    }),
    createRecordsResolvers({ farmService, recordsService }),
    createBriefingResolvers({
      farmService,
      taskService,
      briefingService,
      briefings: deps.briefings,
    }),
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
        user: await services.authService.userForToken(sessionToken),
        sessionToken,
        setCookie: (cookie: string) => {
          pendingCookies.set(request, [...(pendingCookies.get(request) ?? []), cookie]);
        },
      };
    },
  });
}

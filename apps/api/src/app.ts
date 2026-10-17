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
import type { RegisterRepository } from './repositories/registerRepository';
import type { UserRepository } from './repositories/userRepository';
import { createResolvers } from './resolvers';
import { createAuthResolvers } from './resolvers/auth';
import { createDemoAccountService } from './services/demoAccountService';
import { createBriefingResolvers } from './resolvers/briefing';
import { createFarmResolvers } from './resolvers/farms';
import { createMemberResolvers } from './resolvers/members';
import { createRecordsResolvers } from './resolvers/records';
import { createRegisterResolvers } from './resolvers/register';
import { typeDefs } from './schema/typeDefs';
import { createAuthService } from './services/authService';
import { createDemoFarmService } from './services/demoFarmService';
import { createInsightsService } from './services/insightsService';
import { createRegisterService } from './services/registerService';
import { createBriefingService } from './services/briefingService';
import { createFarmService } from './services/farmService';
import { createForecastService } from './services/forecastService';
import { createLocationService } from './services/locationService';
import { createMemberService } from './services/memberService';
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
  register: RegisterRepository;
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
  /** v3.2: "Explore a demo account" on the login page. On unless turned off. */
  demoAccounts?: boolean;
  now?: () => Date;
}

/** Builds every service from the dependencies. Shared by the GraphQL app and the briefing job. */
export function createServices(deps: AppDeps) {
  const locations = createLocationService(deps);
  const forecastService = createForecastService({ ...deps, locations });
  const petService = createPetService({
    animals: deps.animals,
    locations,
    forecastService,
    now: deps.now,
  });
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
  const memberService = createMemberService({
    farms: deps.farms,
    users: deps.users,
    tasks: deps.tasks,
    farmService,
    email: deps.email,
    logger: deps.logger,
    appUrl: deps.appUrl,
  });
  const hasher = deps.hasher ?? createScryptHasher();
  const authService = createAuthService({ users: deps.users, hasher, now: deps.now });
  const registerService = createRegisterService({
    register: deps.register,
    farms: deps.farms,
    farmService,
    now: deps.now,
  });
  const insightsService = createInsightsService({
    farms: deps.farms,
    records: deps.records,
    tasks: deps.tasks,
    recordsService,
    registerService,
    forecastService,
    locations,
    now: deps.now,
  });
  const demoFarmService = createDemoFarmService({
    farmService,
    registerService,
    recordsService,
    taskService,
    locations,
    now: deps.now,
  });
  const demoAccountService = createDemoAccountService({
    enabled: deps.demoAccounts ?? true,
    authService,
    demoFarmService,
    petService,
    recordsService,
    taskService,
    users: deps.users,
    farms: deps.farms,
    hasher,
    now: deps.now,
  });
  return {
    demoAccountService,
    forecastService,
    registerService,
    insightsService,
    demoFarmService,
    petService,
    farmService,
    recordsService,
    taskService,
    briefingService,
    authService,
    memberService,
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
      demoAccountService: services.demoAccountService,
      secureCookies: deps.secureCookies ?? false,
    }),
    createRecordsResolvers({ farmService, recordsService }),
    createMemberResolvers({
      farmService,
      memberService: services.memberService,
      users: deps.users,
    }),
    createRegisterResolvers({
      farmService,
      registerService: services.registerService,
      insightsService: services.insightsService,
      demoFarmService: services.demoFarmService,
    }),
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

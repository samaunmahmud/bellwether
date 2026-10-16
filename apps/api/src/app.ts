import { createSchema, createYoga } from 'graphql-yoga';
import type { Cache } from './cache/cache';
import type { PostcodeClient } from './clients/postcodesClient';
import type { WeatherClient } from './clients/weatherClient';
import type { Logger } from './logger';
import type { AnimalRepository } from './repositories/animalRepository';
import type { FarmRepository } from './repositories/farmRepository';
import { createResolvers } from './resolvers';
import { createFarmResolvers } from './resolvers/farms';
import { typeDefs } from './schema/typeDefs';
import { createFarmService } from './services/farmService';
import { createForecastService } from './services/forecastService';
import { createLocationService } from './services/locationService';

export interface AppDeps {
  postcodes: PostcodeClient;
  weather: WeatherClient;
  cache: Cache;
  animals: AnimalRepository;
  farms: FarmRepository;
  logger: Logger;
  now?: () => Date;
}

/** Builds the GraphQL app from its dependencies, so tests can swap in fakes. */
export function createApp(deps: AppDeps) {
  const locations = createLocationService(deps);
  const forecastService = createForecastService({ ...deps, locations });
  const farmService = createFarmService({ repo: deps.farms, locations, now: deps.now });
  const resolvers = [
    createResolvers({ forecastService, animals: deps.animals }),
    createFarmResolvers({ farmService, forecastService }),
  ];

  return createYoga({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: '/graphql',
    logging: false,
  });
}

import { createSchema, createYoga } from 'graphql-yoga';
import type { Cache } from './cache/cache';
import type { PostcodeClient } from './clients/postcodesClient';
import type { WeatherClient } from './clients/weatherClient';
import type { Logger } from './logger';
import type { AnimalRepository } from './repositories/animalRepository';
import { createResolvers } from './resolvers';
import { typeDefs } from './schema/typeDefs';
import { createForecastService } from './services/forecastService';

export interface AppDeps {
  postcodes: PostcodeClient;
  weather: WeatherClient;
  cache: Cache;
  animals: AnimalRepository;
  logger: Logger;
  now?: () => Date;
}

/** Builds the GraphQL app from its dependencies, so tests can swap in fakes. */
export function createApp(deps: AppDeps) {
  const forecastService = createForecastService(deps);
  const resolvers = createResolvers({ forecastService, animals: deps.animals });

  return createYoga({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: '/graphql',
    logging: false,
  });
}

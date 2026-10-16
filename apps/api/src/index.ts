import { createServer } from 'node:http';
import { createApp } from './app';
import { createRedisCache, MemoryCache } from './cache/cache';
import { createPostcodesIoClient } from './clients/postcodesClient';
import { createOpenMeteoClient } from './clients/weatherClient';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { InMemoryAnimalRepository } from './repositories/animalRepository';

const config = loadConfig();
const logger = createLogger(config.logLevel);

const cache = config.redisUrl ? createRedisCache(config.redisUrl) : new MemoryCache();
if (!config.redisUrl) logger.warn('REDIS_URL not set, using in-memory cache');

const app = createApp({
  postcodes: createPostcodesIoClient(config.postcodesApiBase),
  weather: createOpenMeteoClient(config.weatherApiBase),
  cache,
  animals: new InMemoryAnimalRepository(),
  logger,
});

createServer(app).listen(config.port, () => {
  logger.info(`Bellwether API running at http://localhost:${config.port}/graphql`);
});

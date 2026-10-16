import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createApp } from './app';
import { createRedisCache, MemoryCache } from './cache/cache';
import { createPostcodesIoClient } from './clients/postcodesClient';
import { createOpenMeteoClient } from './clients/weatherClient';
import { loadConfig } from './config';
import { createPrismaClient } from './db/prisma';
import { createLogger } from './logger';
import { InMemoryAnimalRepository } from './repositories/animalRepository';
import { InMemoryFarmRepository } from './repositories/farmRepository';
import { PrismaFarmRepository } from './repositories/prismaFarmRepository';

// Local dev: npm runs workspace scripts from apps/api, so the repo-root .env is two levels up.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

const config = loadConfig();
const logger = createLogger(config.logLevel);

const cache = config.redisUrl ? createRedisCache(config.redisUrl) : new MemoryCache();
if (!config.redisUrl) logger.warn('REDIS_URL not set, using in-memory cache');

const farms = config.databaseUrl
  ? new PrismaFarmRepository(createPrismaClient(config.databaseUrl))
  : new InMemoryFarmRepository();
if (!config.databaseUrl) logger.warn('DATABASE_URL not set, farm data is kept in memory only');

const app = createApp({
  postcodes: createPostcodesIoClient(config.postcodesApiBase),
  weather: createOpenMeteoClient(config.weatherApiBase),
  cache,
  animals: new InMemoryAnimalRepository(),
  farms,
  logger,
});

createServer(app).listen(config.port, () => {
  logger.info(`Bellwether API running at http://localhost:${config.port}/graphql`);
});

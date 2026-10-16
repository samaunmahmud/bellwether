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
import { PrismaUserRepository } from './repositories/prismaUserRepository';
import { InMemoryUserRepository } from './repositories/userRepository';

// Local dev: npm runs workspace scripts from apps/api, so the repo-root .env is two levels up.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

const config = loadConfig();
const logger = createLogger(config.logLevel);

const cache = config.redisUrl ? createRedisCache(config.redisUrl) : new MemoryCache();
if (!config.redisUrl) logger.warn('REDIS_URL not set, using in-memory cache');

const prisma = config.databaseUrl ? createPrismaClient(config.databaseUrl) : null;
const farms = prisma ? new PrismaFarmRepository(prisma) : new InMemoryFarmRepository();
const users = prisma ? new PrismaUserRepository(prisma) : new InMemoryUserRepository();
if (!prisma) logger.warn('DATABASE_URL not set, users and farm data are kept in memory only');

const app = createApp({
  postcodes: createPostcodesIoClient(config.postcodesApiBase),
  weather: createOpenMeteoClient(config.weatherApiBase),
  cache,
  animals: new InMemoryAnimalRepository(),
  farms,
  users,
  logger,
  secureCookies: config.secureCookies,
});

createServer(app).listen(config.port, () => {
  logger.info(`Bellwether API running at http://localhost:${config.port}/graphql`);
});

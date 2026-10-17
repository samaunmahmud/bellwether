import { existsSync } from 'node:fs';
import type { AppDeps } from './app';
import { createRedisCache, MemoryCache } from './cache/cache';
import { createPostcodesIoClient } from './clients/postcodesClient';
import { createOpenMeteoClient } from './clients/weatherClient';
import { loadConfig } from './config';
import { createPrismaClient } from './db/prisma';
import { createLoggingSender, createSmtpSender } from './email/emailSender';
import { createLogger } from './logger';
import { InMemoryAnimalRepository } from './repositories/animalRepository';
import { PrismaAnimalRepository } from './repositories/prismaAnimalRepository';
import {
  InMemoryBriefingRepository,
  InMemoryTaskRepository,
} from './repositories/briefingRepository';
import { InMemoryFarmRepository } from './repositories/farmRepository';
import {
  PrismaBriefingRepository,
  PrismaTaskRepository,
} from './repositories/prismaBriefingRepository';
import { PrismaFarmRepository } from './repositories/prismaFarmRepository';
import { PrismaRecordsRepository } from './repositories/prismaRecordsRepository';
import { PrismaRegisterRepository } from './repositories/prismaRegisterRepository';
import { PrismaUserRepository } from './repositories/prismaUserRepository';
import { InMemoryRecordsRepository } from './repositories/recordsRepository';
import { InMemoryRegisterRepository } from './repositories/registerRepository';
import { InMemoryUserRepository } from './repositories/userRepository';

/**
 * Builds the real dependencies from the environment: Postgres, Redis, SMTP and the live
 * postcode and weather APIs, each falling back to an in-memory or logging stand-in when unset.
 * Shared by the server and scripts such as the demo seed.
 */
export function buildRuntime() {
  // Local dev: npm runs workspace scripts from apps/api, so the repo-root .env is two levels up.
  if (existsSync('../../.env')) process.loadEnvFile('../../.env');

  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const cache = config.redisUrl ? createRedisCache(config.redisUrl) : new MemoryCache();
  if (!config.redisUrl) logger.warn('REDIS_URL not set, using in-memory cache');

  const prisma = config.databaseUrl ? createPrismaClient(config.databaseUrl) : null;
  if (!prisma) logger.warn('DATABASE_URL not set, all data is kept in memory only');
  if (!config.smtpUrl) logger.warn('SMTP_URL not set, briefing emails are logged, not sent');

  const deps: AppDeps = {
    postcodes: createPostcodesIoClient(config.postcodesApiBase),
    weather: createOpenMeteoClient(config.weatherApiBase, fetch, config.weatherArchiveApiBase),
    cache,
    animals: prisma ? new PrismaAnimalRepository(prisma) : new InMemoryAnimalRepository(),
    farms: prisma ? new PrismaFarmRepository(prisma) : new InMemoryFarmRepository(),
    users: prisma ? new PrismaUserRepository(prisma) : new InMemoryUserRepository(),
    records: prisma ? new PrismaRecordsRepository(prisma) : new InMemoryRecordsRepository(),
    register: prisma ? new PrismaRegisterRepository(prisma) : new InMemoryRegisterRepository(),
    tasks: prisma ? new PrismaTaskRepository(prisma) : new InMemoryTaskRepository(),
    briefings: prisma ? new PrismaBriefingRepository(prisma) : new InMemoryBriefingRepository(),
    email: config.smtpUrl
      ? createSmtpSender(config.smtpUrl, config.emailFrom)
      : createLoggingSender(logger),
    logger,
    appUrl: config.appUrl,
    secureCookies: config.secureCookies,
    demoAccounts: config.demoAccounts,
  };

  return { config, logger, deps };
}

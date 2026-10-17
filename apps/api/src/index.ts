import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createApp, createServices, type AppDeps } from './app';
import { createRedisCache, MemoryCache } from './cache/cache';
import { createPostcodesIoClient } from './clients/postcodesClient';
import { createOpenMeteoClient } from './clients/weatherClient';
import { loadConfig } from './config';
import { createPrismaClient } from './db/prisma';
import { createLoggingSender, createSmtpSender } from './email/emailSender';
import { createBriefingJob } from './jobs/briefingJob';
import { createPetReminderJob } from './jobs/petReminderJob';
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
};

const services = createServices(deps);
const app = createApp(deps, services);

createServer(app).listen(config.port, () => {
  logger.info(`Bellwether API running at http://localhost:${config.port}/graphql`);
});

// FR-4.5 / FR-4.3: generate each farm's daily briefing and send emails at each user's chosen time.
if (config.briefingJobMinutes > 0) {
  const job = createBriefingJob({ ...deps, services });
  const petJob = createPetReminderJob(deps);
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const summary = await job.runOnce();
      logger.debug(`briefing job: ${JSON.stringify(summary)}`);
    } catch (err) {
      logger.warn(`briefing job failed: ${(err as Error).message}`);
    }
    try {
      const summary = await petJob.runOnce();
      logger.debug(`pet reminder job: ${JSON.stringify(summary)}`);
    } catch (err) {
      logger.warn(`pet reminder job failed: ${(err as Error).message}`);
    } finally {
      running = false;
    }
  };
  setInterval(tick, config.briefingJobMinutes * 60 * 1000).unref();
  void tick();
}

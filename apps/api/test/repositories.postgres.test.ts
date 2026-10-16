import { afterAll, describe } from 'vitest';
import { createPrismaClient } from '../src/db/prisma';
import {
  PrismaBriefingRepository,
  PrismaTaskRepository,
} from '../src/repositories/prismaBriefingRepository';
import { PrismaFarmRepository } from '../src/repositories/prismaFarmRepository';
import { PrismaRecordsRepository } from '../src/repositories/prismaRecordsRepository';
import { PrismaUserRepository } from '../src/repositories/prismaUserRepository';
import { farmRepositoryContract } from './farmRepository.contract';
import { sheepGroup } from './farmRepository.contract';
import { recordsRepositoryContract } from './recordsRepository.contract';
import { briefingRepositoryContract } from './briefingRepository.contract';
import { userRepositoryContract } from './userRepository.contract';

// The same contract suites as the in-memory fakes, run against real Postgres.
// Only when a migrated test database is available: `npm run db:test:prepare`.
// Kept in one file so the suites run one after another and don't truncate each other's tables.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('Postgres repositories', () => {
  const prisma = createPrismaClient(testDatabaseUrl ?? '');
  const reset = () => prisma.$executeRawUnsafe('TRUNCATE "Farm", "User" CASCADE');

  afterAll(() => prisma.$disconnect());

  describe('PrismaUserRepository', () => {
    userRepositoryContract(async () => {
      await reset();
      return new PrismaUserRepository(prisma);
    });
  });

  describe('PrismaFarmRepository', () => {
    farmRepositoryContract(async () => {
      await reset();
      let n = 0;
      return {
        repo: new PrismaFarmRepository(prisma),
        newUserId: async () =>
          (
            await prisma.user.create({
              data: { email: `user${++n}@example.com`, passwordHash: 'x' },
            })
          ).id,
      };
    });
  });

  describe('PrismaRecordsRepository', () => {
    recordsRepositoryContract(async () => {
      await reset();
      const farms = new PrismaFarmRepository(prisma);
      let n = 0;
      return {
        repo: new PrismaRecordsRepository(prisma),
        newGroup: async () => {
          const user = await prisma.user.create({
            data: { email: `records${++n}@example.com`, passwordHash: 'x' },
          });
          const farm = await farms.createFarm({ name: 'Farm', postcode: 'UB8 3PH' }, user.id);
          const group = await farms.createGroup(sheepGroup(farm.id), null);
          return { farmId: farm.id, groupId: group.id };
        },
      };
    });
  });

  describe('PrismaTaskRepository and PrismaBriefingRepository', () => {
    briefingRepositoryContract(async () => {
      await reset();
      const farms = new PrismaFarmRepository(prisma);
      let n = 0;
      return {
        tasks: new PrismaTaskRepository(prisma),
        briefings: new PrismaBriefingRepository(prisma),
        newFarm: async () => {
          const user = await prisma.user.create({
            data: { email: `briefing${++n}@example.com`, passwordHash: 'x' },
          });
          const farm = await farms.createFarm({ name: 'Farm', postcode: 'UB8 3PH' }, user.id);
          const group = await farms.createGroup(sheepGroup(farm.id), null);
          return { farmId: farm.id, groupId: group.id, userId: user.id };
        },
      };
    });
  });
});

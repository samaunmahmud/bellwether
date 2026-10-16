import { afterAll, describe } from 'vitest';
import { createPrismaClient } from '../src/db/prisma';
import { InMemoryFarmRepository } from '../src/repositories/farmRepository';
import { PrismaFarmRepository } from '../src/repositories/prismaFarmRepository';
import { farmRepositoryContract } from './farmRepository.contract';

describe('InMemoryFarmRepository', () => {
  farmRepositoryContract(async () => new InMemoryFarmRepository());
});

// Runs only when a migrated test database is available (see README "Running tests").
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('PrismaFarmRepository (Postgres)', () => {
  const prisma = createPrismaClient(testDatabaseUrl ?? '');

  afterAll(() => prisma.$disconnect());

  farmRepositoryContract(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "Farm" CASCADE');
    return new PrismaFarmRepository(prisma);
  });
});

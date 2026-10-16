import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { InMemoryFarmRepository } from '../src/repositories/farmRepository';
import { farmRepositoryContract } from './farmRepository.contract';

describe('InMemoryFarmRepository', () => {
  farmRepositoryContract(async () => ({
    repo: new InMemoryFarmRepository(),
    newUserId: async () => randomUUID(),
  }));
});

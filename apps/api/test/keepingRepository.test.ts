import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { InMemoryKeepingRepository } from '../src/repositories/keepingRepository';
import { keepingRepositoryContract } from './keepingRepository.contract';

describe('InMemoryKeepingRepository', () => {
  keepingRepositoryContract(async () => ({
    repo: new InMemoryKeepingRepository(),
    newFarm: async () => ({ farmId: randomUUID(), userId: randomUUID() }),
    newPet: async () => randomUUID(),
  }));
});

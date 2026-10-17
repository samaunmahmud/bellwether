import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { InMemoryRegisterRepository } from '../src/repositories/registerRepository';
import { registerRepositoryContract } from './registerRepository.contract';

describe('InMemoryRegisterRepository', () => {
  registerRepositoryContract(async () => ({
    repo: new InMemoryRegisterRepository(),
    newGroup: async () => ({ farmId: randomUUID(), groupId: randomUUID() }),
  }));
});

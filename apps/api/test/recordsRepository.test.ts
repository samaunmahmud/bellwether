import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { InMemoryRecordsRepository } from '../src/repositories/recordsRepository';
import { recordsRepositoryContract } from './recordsRepository.contract';

describe('InMemoryRecordsRepository', () => {
  recordsRepositoryContract(async () => ({
    repo: new InMemoryRecordsRepository(),
    newGroup: async () => ({ farmId: randomUUID(), groupId: randomUUID() }),
  }));
});

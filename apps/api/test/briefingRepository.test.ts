import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import {
  InMemoryBriefingRepository,
  InMemoryTaskRepository,
} from '../src/repositories/briefingRepository';
import { briefingRepositoryContract } from './briefingRepository.contract';

describe('In-memory task and briefing repositories', () => {
  briefingRepositoryContract(async () => ({
    tasks: new InMemoryTaskRepository(),
    briefings: new InMemoryBriefingRepository(),
    newFarm: async () => ({ farmId: randomUUID(), groupId: randomUUID(), userId: randomUUID() }),
  }));
});

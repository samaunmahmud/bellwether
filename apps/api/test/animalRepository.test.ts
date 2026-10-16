import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { InMemoryAnimalRepository } from '../src/repositories/animalRepository';
import { animalRepositoryContract } from './animalRepository.contract';

describe('InMemoryAnimalRepository', () => {
  animalRepositoryContract(async () => ({
    repo: new InMemoryAnimalRepository(),
    newOwnerId: async () => randomUUID(),
  }));
});

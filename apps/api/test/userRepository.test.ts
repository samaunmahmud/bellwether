import { describe } from 'vitest';
import { InMemoryUserRepository } from '../src/repositories/userRepository';
import { userRepositoryContract } from './userRepository.contract';

describe('InMemoryUserRepository', () => {
  userRepositoryContract(async () => new InMemoryUserRepository());
});

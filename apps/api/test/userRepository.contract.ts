import { beforeEach, describe, expect, it } from 'vitest';
import type { UserRepository } from '../src/repositories/userRepository';

/** Behaviour every UserRepository must share (in-memory fake and Postgres). */
export function userRepositoryContract(makeRepo: () => Promise<UserRepository>) {
  let repo: UserRepository;

  beforeEach(async () => {
    repo = await makeRepo();
  });

  describe('users', () => {
    it('creates a user and finds its credentials by email', async () => {
      const user = await repo.createUser({ email: 'ann@example.com', passwordHash: 'h1' });
      expect(user).toEqual({ id: expect.any(String), email: 'ann@example.com' });
      expect(await repo.findCredentials('ann@example.com')).toEqual({
        user,
        passwordHash: 'h1',
      });
      expect(await repo.getUser(user!.id)).toEqual(user);
    });

    it('returns null instead of creating a second user with the same email', async () => {
      await repo.createUser({ email: 'ann@example.com', passwordHash: 'h1' });
      expect(await repo.createUser({ email: 'ann@example.com', passwordHash: 'h2' })).toBeNull();
      expect((await repo.findCredentials('ann@example.com'))!.passwordHash).toBe('h1');
    });

    it('returns null for an unknown email or id', async () => {
      expect(await repo.findCredentials('nobody@example.com')).toBeNull();
      expect(await repo.getUser('00000000-0000-0000-0000-000000000000')).toBeNull();
    });
  });

  describe('sessions', () => {
    it('stores, finds and deletes a session by token hash', async () => {
      const user = (await repo.createUser({ email: 'ann@example.com', passwordHash: 'h1' }))!;
      const expiresAt = new Date('2026-07-01T09:00:00.000Z');
      await repo.createSession({ tokenHash: 'th1', userId: user.id, expiresAt });

      expect(await repo.findSession('th1')).toEqual({ userId: user.id, expiresAt });
      await repo.deleteSession('th1');
      expect(await repo.findSession('th1')).toBeNull();
    });

    it('ignores deleting a session that does not exist', async () => {
      await expect(repo.deleteSession('missing')).resolves.toBeUndefined();
    });
  });

  describe('ids that are not UUIDs', () => {
    it('are treated as not found', async () => {
      expect(await repo.getUser('x')).toBeNull();
    });
  });
}

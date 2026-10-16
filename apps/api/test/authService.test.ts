import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createScryptHasher } from '../src/auth/passwords';
import { InMemoryUserRepository } from '../src/repositories/userRepository';
import { createAuthService, SESSION_TTL_SECONDS } from '../src/services/authService';

const code = (c: string) => ({ extensions: { code: c } });
const PASSWORD = 'correct horse battery';

describe('authService (FR-8.1)', () => {
  let now: Date;
  let users: InMemoryUserRepository;
  let auth: ReturnType<typeof createAuthService>;

  beforeEach(() => {
    now = new Date('2026-06-01T09:00:00Z');
    users = new InMemoryUserRepository();
    auth = createAuthService({ users, hasher: createScryptHasher(2 ** 10), now: () => now });
  });

  describe('signUp', () => {
    it('normalises the email, hashes the password and starts a session', async () => {
      const { user, token } = await auth.signUp('  Ann@Example.COM ', PASSWORD);
      expect(user.email).toBe('ann@example.com');
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 256 bits, base64url

      const stored = await users.findCredentials('ann@example.com');
      expect(stored!.passwordHash).not.toContain(PASSWORD);
      expect(await auth.userForToken(token)).toEqual(user);
    });

    it('stores only a hash of the session token', async () => {
      const { token } = await auth.signUp('ann@example.com', PASSWORD);
      const hash = createHash('sha256').update(token).digest('hex');
      expect(await users.findSession(token)).toBeNull();
      expect(await users.findSession(hash)).not.toBeNull();
    });

    it('rejects an email that is already registered', async () => {
      await auth.signUp('ann@example.com', PASSWORD);
      await expect(auth.signUp('ANN@example.com', PASSWORD)).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
    });

    it.each(['', 'ann', 'ann@', '@example.com', 'ann @example.com', 'ann@example'])(
      'rejects the email %j',
      async (email) => {
        await expect(auth.signUp(email, PASSWORD)).rejects.toMatchObject(code('BAD_INPUT'));
      },
    );

    it('accepts passwords of 10 and 128 characters, and rejects 9 and 129 (A11)', async () => {
      await expect(auth.signUp('a@example.com', 'x'.repeat(10))).resolves.toBeDefined();
      await expect(auth.signUp('b@example.com', 'x'.repeat(128))).resolves.toBeDefined();
      await expect(auth.signUp('c@example.com', 'x'.repeat(9))).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
      await expect(auth.signUp('d@example.com', 'x'.repeat(129))).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
    });
  });

  describe('logIn', () => {
    beforeEach(async () => {
      await auth.signUp('ann@example.com', PASSWORD);
    });

    it('starts a new session with the right password, whatever the email case', async () => {
      const { user, token } = await auth.logIn('ANN@example.com', PASSWORD);
      expect(user.email).toBe('ann@example.com');
      expect(await auth.userForToken(token)).toEqual(user);
    });

    it('gives the same error for a wrong password and an unknown email (A12)', async () => {
      await expect(auth.logIn('ann@example.com', 'wrong password!')).rejects.toMatchObject({
        message: 'Email or password is incorrect',
        ...code('BAD_CREDENTIALS'),
      });
      await expect(auth.logIn('nobody@example.com', PASSWORD)).rejects.toMatchObject({
        message: 'Email or password is incorrect',
        ...code('BAD_CREDENTIALS'),
      });
    });
  });

  describe('sessions (A10)', () => {
    it('lasts 30 days: valid one second before, gone on expiry', async () => {
      const { token } = await auth.signUp('ann@example.com', PASSWORD);
      expect(SESSION_TTL_SECONDS).toBe(30 * 24 * 60 * 60);

      now = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000 - 1000);
      expect(await auth.userForToken(token)).not.toBeNull();

      now = new Date(now.getTime() + 1000);
      expect(await auth.userForToken(token)).toBeNull();
    });

    it('ends on log out', async () => {
      const { token } = await auth.signUp('ann@example.com', PASSWORD);
      await auth.logOut(token);
      expect(await auth.userForToken(token)).toBeNull();
    });

    it('returns null for a missing or unknown token', async () => {
      expect(await auth.userForToken(null)).toBeNull();
      expect(await auth.userForToken('not-a-real-token')).toBeNull();
    });
  });
});

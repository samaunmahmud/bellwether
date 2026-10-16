import { createHash, randomBytes } from 'node:crypto';
import type { PasswordHasher } from '../auth/passwords';
import { appError } from '../errors';
import type { User, UserRepository } from '../repositories/userRepository';

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // A10: 30 days
// A11: length over complexity rules. Heuristic TODO(verify source) against current UK guidance.
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
// Deliberately loose: one @, no spaces, a dot in the domain. Real checking would need a verification email (A16).
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BAD_CREDENTIALS = 'Email or password is incorrect';

export interface AuthDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  now?: () => Date;
}

export interface SignedIn {
  user: User;
  /** Goes in the session cookie. Only its hash is stored. */
  token: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function normaliseEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email))
    throw appError('BAD_INPUT', 'Enter a valid email address');
  return email;
}

export function createAuthService(deps: AuthDeps) {
  const now = deps.now ?? (() => new Date());
  // Verified against when the email is unknown, so a login takes the same time either way.
  const dummyHash = deps.hasher.hash('not a real password');

  async function startSession(user: User): Promise<SignedIn> {
    const token = randomBytes(32).toString('base64url');
    await deps.users.createSession({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(now().getTime() + SESSION_TTL_SECONDS * 1000),
    });
    return { user, token };
  }

  return {
    /** FR-8.1 */
    async signUp(rawEmail: string, password: string): Promise<SignedIn> {
      const email = normaliseEmail(rawEmail);
      if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH)
        throw appError(
          'BAD_INPUT',
          `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`,
        );

      const user = await deps.users.createUser({
        email,
        passwordHash: await deps.hasher.hash(password),
      });
      if (!user) throw appError('BAD_INPUT', 'An account with this email already exists');
      return startSession(user);
    },

    /** FR-8.1. Same error for an unknown email and a wrong password (A12). */
    async logIn(rawEmail: string, password: string): Promise<SignedIn> {
      const found = await deps.users.findCredentials(rawEmail.trim().toLowerCase());
      const ok = await deps.hasher.verify(password, found?.passwordHash ?? (await dummyHash));
      if (!found || !ok) throw appError('BAD_CREDENTIALS', BAD_CREDENTIALS);
      return startSession(found.user);
    },

    async logOut(token: string): Promise<void> {
      await deps.users.deleteSession(hashToken(token));
    },

    /** The signed-in user for a session token, or null if it is missing, unknown or expired. */
    async userForToken(token: string | null): Promise<User | null> {
      if (!token) return null;
      const tokenHash = hashToken(token);
      const session = await deps.users.findSession(tokenHash);
      if (!session) return null;
      if (session.expiresAt.getTime() <= now().getTime()) {
        await deps.users.deleteSession(tokenHash);
        return null;
      }
      return deps.users.getUser(session.userId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

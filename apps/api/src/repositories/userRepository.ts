import { randomUUID } from 'node:crypto';

export interface User {
  id: string;
  email: string;
}

export interface NewSession {
  /** SHA-256 of the session token. The token itself is never stored. */
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

/** Storage for users and their sessions (FR-8.1). */
export interface UserRepository {
  /** Returns null if the email is already registered. Emails arrive normalised. */
  createUser(input: { email: string; passwordHash: string }): Promise<User | null>;
  findCredentials(email: string): Promise<{ user: User; passwordHash: string } | null>;
  getUser(id: string): Promise<User | null>;

  createSession(session: NewSession): Promise<void>;
  findSession(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User & { passwordHash: string }>();
  private sessions = new Map<string, { userId: string; expiresAt: Date }>();

  constructor(private newId: () => string = randomUUID) {}

  async createUser(input: { email: string; passwordHash: string }) {
    if ([...this.users.values()].some((u) => u.email === input.email)) return null;
    const user = { ...input, id: this.newId() };
    this.users.set(user.id, user);
    return { id: user.id, email: user.email };
  }

  async findCredentials(email: string) {
    const found = [...this.users.values()].find((u) => u.email === email);
    return found
      ? { user: { id: found.id, email: found.email }, passwordHash: found.passwordHash }
      : null;
  }

  async getUser(id: string) {
    const found = this.users.get(id);
    return found ? { id: found.id, email: found.email } : null;
  }

  async createSession(session: NewSession) {
    this.sessions.set(session.tokenHash, { userId: session.userId, expiresAt: session.expiresAt });
  }

  async findSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    return session ? { ...session } : null;
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
}

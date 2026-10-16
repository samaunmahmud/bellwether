import type { PrismaClient } from '../db/prisma';
import { Prisma } from '../generated/prisma/client';
import type { NewSession, UserRepository } from './userRepository';

const userSelect = { id: true, email: true } as const;

/** Postgres-backed UserRepository. Shares its contract tests with InMemoryUserRepository. */
export class PrismaUserRepository implements UserRepository {
  constructor(private db: PrismaClient) {}

  async createUser(input: { email: string; passwordHash: string }) {
    try {
      return await this.db.user.create({ data: input, select: userSelect });
    } catch (err) {
      // P2002: unique constraint failed, i.e. the email is already registered.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null;
      throw err;
    }
  }

  async findCredentials(email: string) {
    const row = await this.db.user.findUnique({
      where: { email },
      select: { ...userSelect, passwordHash: true },
    });
    return row ? { user: { id: row.id, email: row.email }, passwordHash: row.passwordHash } : null;
  }

  getUser(id: string) {
    return this.db.user.findUnique({ where: { id }, select: userSelect });
  }

  async createSession(session: NewSession) {
    await this.db.session.create({ data: session });
  }

  findSession(tokenHash: string) {
    return this.db.session.findUnique({
      where: { tokenHash },
      select: { userId: true, expiresAt: true },
    });
  }

  async deleteSession(tokenHash: string) {
    await this.db.session.deleteMany({ where: { tokenHash } });
  }
}

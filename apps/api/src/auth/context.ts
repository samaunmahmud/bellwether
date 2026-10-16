import { appError } from '../errors';
import type { User } from '../repositories/userRepository';

/** Per-request GraphQL context. */
export interface GraphQLContext {
  /** The signed-in user, or null for anonymous requests. */
  user: User | null;
  /** The raw session token from the cookie, needed to log out. */
  sessionToken: string | null;
  /** Adds a Set-Cookie header to this request's response. */
  setCookie(cookie: string): void;
}

/** Throws UNAUTHENTICATED unless someone is signed in (FR-8.1). */
export function requireUser(ctx: GraphQLContext): User {
  if (!ctx.user) throw appError('UNAUTHENTICATED', 'Please log in to continue');
  return ctx.user;
}

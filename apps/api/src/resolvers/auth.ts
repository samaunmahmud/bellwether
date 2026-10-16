import type { GraphQLContext } from '../auth/context';
import { clearSessionCookie, sessionCookie } from '../auth/cookies';
import { SESSION_TTL_SECONDS, type AuthService, type SignedIn } from '../services/authService';

export interface AuthResolverDeps {
  authService: AuthService;
  secureCookies: boolean;
}

interface Credentials {
  email: string;
  password: string;
}

/** Sign-up, log-in, log-out and `me` (FR-8.1). The session travels in an httpOnly cookie (A10). */
export function createAuthResolvers({ authService, secureCookies }: AuthResolverDeps) {
  function startSession(ctx: GraphQLContext, { user, token }: SignedIn) {
    ctx.setCookie(
      sessionCookie(token, { maxAgeSeconds: SESSION_TTL_SECONDS, secure: secureCookies }),
    );
    return user;
  }

  return {
    Query: {
      me: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.user,
    },

    Mutation: {
      signUp: async (_: unknown, args: Credentials, ctx: GraphQLContext) =>
        startSession(ctx, await authService.signUp(args.email, args.password)),
      logIn: async (_: unknown, args: Credentials, ctx: GraphQLContext) =>
        startSession(ctx, await authService.logIn(args.email, args.password)),
      logOut: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
        if (ctx.sessionToken) await authService.logOut(ctx.sessionToken);
        ctx.setCookie(clearSessionCookie(secureCookies));
        return true;
      },
    },
  };
}

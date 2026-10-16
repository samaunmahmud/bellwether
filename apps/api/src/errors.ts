import { createGraphQLError } from 'graphql-yoga';

export type AppErrorCode =
  | 'INVALID_POSTCODE'
  | 'POSTCODE_NOT_FOUND'
  | 'UPSTREAM_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'BAD_INPUT'
  | 'UNAUTHENTICATED'
  | 'BAD_CREDENTIALS';

/**
 * Errors safe to show to the user. Yoga exposes GraphQL errors and masks everything else.
 * We use Yoga's own factory so the error is always recognised, whichever build of
 * `graphql` (ESM or CJS) ends up loaded.
 */
export function appError(code: AppErrorCode, message: string) {
  return createGraphQLError(message, { extensions: { code } });
}

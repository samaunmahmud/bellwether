/** A message safe to show the user. The API only exposes user-facing GraphQL errors. */
export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Something went wrong. Please try again.';
}

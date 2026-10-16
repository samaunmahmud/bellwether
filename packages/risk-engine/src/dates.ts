const DAY_MS = 24 * 60 * 60 * 1000;

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Whole days from `from` to `to` (ISO dates). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** The ISO date `days` after `iso` (negative for earlier). */
export function addDays(iso: string, days: number): string {
  return new Date(utc(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const londonDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in the UK (YYYY-MM-DD), which differs from the UTC date around midnight in summer. */
export function londonToday(now: Date): string {
  return londonDate.format(now);
}

const londonClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** UK wall-clock time as HH:MM. */
export function londonTime(now: Date): string {
  return londonClock.format(now);
}

/** "2026-06-01" → "Mon 1 Jun" */
export function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

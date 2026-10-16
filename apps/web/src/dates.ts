/** Today as an ISO date string (YYYY-MM-DD) in local time. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOverdue(nextDueDate: string | null, today: string = todayIso()): boolean {
  return nextDueDate !== null && nextDueDate < today;
}

/** "2026-06-01" → "Mon 1 Jun" */
export function shortDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

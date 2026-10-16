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

/** "2026-03-01" → "1 Mar" */
export function dayMonth(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const LEVEL_WORD = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' } as const;

const weekdayDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });

const nextDay = (iso: string) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return todayIso(date);
};

/**
 * Affected days as short ranges, e.g. "Fri 16–Sun 18 Oct: High · Thu 22 Oct: Medium".
 * Consecutive days at the same level are joined, so the briefing stays short on a phone.
 */
export function dayRanges(days: Array<{ date: string; level: keyof typeof LEVEL_WORD }>): string {
  const ranges: Array<{ start: string; end: string; level: keyof typeof LEVEL_WORD }> = [];
  for (const day of days) {
    const last = ranges.at(-1);
    if (last && last.level === day.level && nextDay(last.end) === day.date) last.end = day.date;
    else ranges.push({ start: day.date, end: day.date, level: day.level });
  }
  return ranges
    .map(({ start, end, level }) => {
      if (start === end) return `${shortDay(start)}: ${LEVEL_WORD[level]}`;
      const sameMonth = start.slice(0, 7) === end.slice(0, 7);
      const from = sameMonth ? weekdayDay(start) : shortDay(start);
      return `${from}–${shortDay(end)}: ${LEVEL_WORD[level]}`;
    })
    .join(' · ');
}

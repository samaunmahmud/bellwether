import { daysBetween } from '@bellwether/risk-engine';
import type { LogEntry } from '../repositories/animalRepository';

export interface PlanItem {
  logId: string;
  type: string;
  nextDueDate: string;
  /** Days from today to the due date; negative when it has passed. */
  days: number;
}

/**
 * Days from the due date on which an owner is reminded: a week before, on the day, and once
 * when 3 days late. Product choice to avoid a daily email, not a veterinary schedule.
 */
export const REMINDER_DAYS = [7, 0, -3] as const;

/**
 * What's due next for a pet: the latest entry of each type (logs come newest first), if it has a
 * next due date. A newer entry of the same type without one means it has been dealt with.
 */
export function currentPlan(logs: LogEntry[], today: string): PlanItem[] {
  const latest = new Map<string, LogEntry>();
  for (const log of logs) if (!latest.has(log.type)) latest.set(log.type, log);
  return [...latest.values()]
    .filter((l): l is LogEntry & { nextDueDate: string } => l.nextDueDate !== null)
    .map((l) => ({
      logId: l.id,
      type: l.type,
      nextDueDate: l.nextDueDate,
      days: daysBetween(today, l.nextDueDate),
    }))
    .sort((a, b) => a.days - b.days || a.type.localeCompare(b.type));
}

/** The items worth an email today. */
export const remindersDue = (plan: PlanItem[]) =>
  plan.filter((p) => (REMINDER_DAYS as readonly number[]).includes(p.days));

export function dueText(days: number) {
  if (days === 0) return 'due today';
  if (days > 0) return `due in ${days} ${days === 1 ? 'day' : 'days'}`;
  return `overdue by ${-days} ${days === -1 ? 'day' : 'days'}`;
}

import {
  HEATSTROKE_HIGH_MAX_C,
  HEATSTROKE_MEDIUM_MAX_C,
  type DailyWeather,
} from '@bellwether/risk-engine';

export type WalkLevel = 'GOOD' | 'WARM' | 'HOT';

export interface WalkHour {
  /** Local time, e.g. 2026-06-01T07:00 */
  time: string;
  tempC: number;
  level: WalkLevel;
}

export interface WalkPlan {
  date: string;
  hours: WalkHour[];
  /** Runs of GOOD hours, e.g. "06:00–09:00" */
  bestTimes: string[];
}

/** Daytime hours worth planning a walk in */
const FIRST_HOUR = 6;
const LAST_HOUR = 22;

/**
 * v3: rates each daytime hour for a dog walk using the same heuristic thresholds as the dog
 * heatstroke module, applied to the hour's temperature. TODO(verify source), as for that module.
 */
export function walkLevel(tempC: number): WalkLevel {
  if (tempC < HEATSTROKE_MEDIUM_MAX_C) return 'GOOD';
  return tempC <= HEATSTROKE_HIGH_MAX_C ? 'WARM' : 'HOT';
}

const hourOf = (time: string) => Number(time.slice(11, 13));
const clock = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** The first forecast day from `today` with hourly data, or null if there is none. */
export function walkPlan(days: DailyWeather[], today: string): WalkPlan | null {
  const day = days.find((d) => d.date >= today && d.hours && d.hours.length > 0);
  if (!day) return null;
  const hours = day
    .hours!.filter((h) => hourOf(h.time) >= FIRST_HOUR && hourOf(h.time) <= LAST_HOUR)
    .map((h) => ({
      time: h.time,
      tempC: Math.round(h.tempC * 10) / 10,
      level: walkLevel(h.tempC),
    }));

  const bestTimes: string[] = [];
  let start: number | null = null;
  hours.forEach((h, i) => {
    const good = h.level === 'GOOD';
    if (good && start === null) start = hourOf(h.time);
    const next = hours[i + 1];
    if (start !== null && (!good || !next || next.level !== 'GOOD')) {
      bestTimes.push(`${clock(start)}–${clock(hourOf(h.time) + (good ? 1 : 0))}`);
      start = null;
    }
  });
  return { date: day.date, hours, bestTimes };
}

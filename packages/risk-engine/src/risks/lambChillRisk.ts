import { addDays } from '../dates';
import { clampScore, LEVEL_SCORE } from '../levels';
import type { DailyRisk, DailyWeather, RiskContext, RiskLevel, RiskModule } from '../types';

/*
 * FR-3.2: newborn lamb chill, using the chill index (potential heat loss, kJ/m²/h):
 *
 *   C = (11.7 + 3.1·√v)(40 − T) + 481 + 418·(1 − e^(−0.04·R))
 *
 * v = wind speed (m/s), T = mean air temperature (°C), R = daily rainfall (mm).
 * Secondary sources attribute this form to Nixon-Smith (1972), applied to newborn lambs
 * by Donnelly (1984). TODO(verify source): check the formula against the original papers.
 *
 * The wind in the formula was measured near the ground; we use Open-Meteo's 10 m wind
 * unadjusted, which will tend to overstate chill. TODO(verify source): adjust for height?
 */
const CHILL_BASE_COEFF = 11.7; // heuristic TODO(verify source)
const CHILL_WIND_COEFF = 3.1; // heuristic TODO(verify source)
const CHILL_REFERENCE_C = 40; // heuristic TODO(verify source)
const CHILL_CONSTANT = 481; // heuristic TODO(verify source)
const CHILL_RAIN_MAX = 418; // heuristic TODO(verify source)
const CHILL_RAIN_RATE = 0.04; // heuristic TODO(verify source)

// Bands. Published guidance treats values above about 1000 as a risk to newborn lambs.
// heuristic TODO(verify source): confirm both band edges.
export const CHILL_MEDIUM = 1000;
export const CHILL_HIGH = 1100;

/** Lambs count as newborn for this many days after the last lambing date (first ~72 hours). */
export const NEWBORN_DAYS = 3; // heuristic TODO(verify source)

// Range used to map the index onto the 0–100 chart score.
const CHILL_SCORE_MIN = 800;
const CHILL_SCORE_MAX = 1300;

export function calculateChillIndex(w: { tempC: number; windMs: number; rainMm: number }): number {
  return (
    (CHILL_BASE_COEFF + CHILL_WIND_COEFF * Math.sqrt(Math.max(0, w.windMs))) *
      (CHILL_REFERENCE_C - w.tempC) +
    CHILL_CONSTANT +
    CHILL_RAIN_MAX * (1 - Math.exp(-CHILL_RAIN_RATE * Math.max(0, w.rainMm)))
  );
}

export function chillLevel(index: number): RiskLevel {
  if (index < CHILL_MEDIUM) return 'LOW';
  return index < CHILL_HIGH ? 'MEDIUM' : 'HIGH';
}

const OUTCOME: Record<RiskLevel, string> = {
  LOW: 'low chill risk for newborn lambs',
  MEDIUM: 'some chill risk for newborn lambs',
  HIGH: 'newborn lambs at high risk of chilling',
};

/** The days on which newborn lambs may be outside: lambing start to end + NEWBORN_DAYS. */
function newbornWindow(ctx: RiskContext): { start: string; end: string } | null {
  const g = ctx.group;
  if (!g?.lambingStart || !g.lambingEnd) return null;
  return { start: g.lambingStart, end: addDays(g.lambingEnd, NEWBORN_DAYS) };
}

function assessDay(day: DailyWeather, ctx: RiskContext): DailyRisk {
  const window = newbornWindow(ctx);
  if (window && (day.date < window.start || day.date > window.end)) {
    return {
      date: day.date,
      level: 'LOW',
      score: LEVEL_SCORE.LOW,
      reason: 'Outside the lambing period',
    };
  }

  const windMs = day.windSpeedMeanMs ?? 0;
  const index = calculateChillIndex({
    tempC: day.tempMeanC,
    windMs,
    rainMm: day.precipitationMm,
  });
  const level = chillLevel(index);
  const wind = day.windSpeedMeanMs === undefined ? 'no wind data' : `wind ${windMs.toFixed(1)} m/s`;

  let reason =
    `Chill index ${Math.round(index)} kJ/m²/h ` +
    `(${day.tempMeanC.toFixed(1)}°C, ${wind}, ${day.precipitationMm.toFixed(1)} mm rain): ` +
    OUTCOME[level];
  if (ctx.group?.housed) reason += ' (housed: lambs indoors are more sheltered than this)';

  const score = clampScore(((index - CHILL_SCORE_MIN) / (CHILL_SCORE_MAX - CHILL_SCORE_MIN)) * 100);
  return { date: day.date, level, score, reason };
}

export const lambChillRisk: RiskModule = {
  id: 'lamb-chill',
  name: 'Newborn lamb chill',
  category: 'farm',
  animals: ['sheep'],
  assess(days, ctx = {}) {
    return days.map((day) => assessDay(day, ctx));
  },
  /** Only for sheep whose lambing (plus the newborn days) overlaps the forecast. */
  appliesTo(ctx, days) {
    const window = newbornWindow(ctx);
    const first = days[0]?.date;
    const last = days.at(-1)?.date;
    if (ctx.group?.species !== 'sheep' || !window || !first || !last) return false;
    return window.start <= last && window.end >= first;
  },
};

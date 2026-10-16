import { LEVEL_SCORE, raiseLevel } from '../levels';
import type {
  DailyRisk,
  DailyWeather,
  RiskContext,
  RiskLevel,
  RiskModule,
  SuggestedChecks,
} from '../types';

// Heuristic thresholds. Ticks are most active in mild, humid conditions and
// quieter when cold, or when hot and dry.
// heuristic TODO(verify source): check these against UK veterinary / parasitology guidance.
export const TICK_COLD_MEAN_C = 5;
export const TICK_ACTIVE_MEAN_C = 7;
export const TICK_HUMID_PCT = 80;
export const TICK_HOT_MAX_C = 28;
export const TICK_DRY_PCT = 60;

function assessDay(day: DailyWeather, ctx: RiskContext): DailyRisk {
  let level: RiskLevel;
  let reason: string;

  if (day.tempMeanC < TICK_COLD_MEAN_C) {
    level = 'LOW';
    reason = 'Too cold for much tick activity';
  } else if (day.tempMaxC >= TICK_HOT_MAX_C && day.humidityMeanPct < TICK_DRY_PCT) {
    level = 'LOW';
    reason = 'Hot and dry: ticks less active';
  } else if (day.tempMeanC >= TICK_ACTIVE_MEAN_C && day.humidityMeanPct >= TICK_HUMID_PCT) {
    level = 'HIGH';
    reason = 'Mild and humid: ticks likely active';
  } else {
    level = 'MEDIUM';
    reason = 'Some tick activity possible';
  }

  if (ctx.highExposureHabitat && level !== 'HIGH') {
    level = raiseLevel(level);
    reason += '; raised because of walks in long grass or woodland';
  }

  return { date: day.date, level, score: LEVEL_SCORE[level], reason };
}

/** FR-5.1: general husbandry checks only. Never products, doses or withdrawal periods. */
const CHECKS: SuggestedChecks = {
  MEDIUM: ["Check your pet's coat and skin for ticks after walks"],
  HIGH: [
    'Check your pet for ticks after every walk, especially ears, armpits and between toes',
    'Speak to your vet about tick protection',
  ],
};

export const tickRisk: RiskModule = {
  checks: CHECKS,
  id: 'tick',
  name: 'Tick activity',
  category: 'pet',
  animals: ['dog', 'cat'],
  assess(days, ctx = {}) {
    return days.map((day) => assessDay(day, ctx));
  },
};

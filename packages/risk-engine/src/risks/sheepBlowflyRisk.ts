import { daysBetween } from '../dates';
import { LEVEL_SCORE, raiseLevel } from '../levels';
import type {
  DailyRisk,
  DailyWeather,
  RiskContext,
  RiskLevel,
  RiskModule,
  SuggestedChecks,
} from '../types';

// Heuristic thresholds. Blowfly strike risk rises in warm, humid weather,
// especially after rain.
// heuristic TODO(verify source): check against UK sheep health / flystrike guidance.
export const BLOWFLY_COLD_MEAN_C = 9;
export const BLOWFLY_WARM_MEAN_C = 15;
export const BLOWFLY_HUMID_PCT = 70;
export const BLOWFLY_RAIN_MM = 2;
// FR-3.4: fleece regrowth after which shorn sheep are treated as unshorn again (~6 weeks).
// heuristic TODO(verify source)
export const BLOWFLY_FLEECE_DAYS = 42;

/** Why a flock's fleece raises the risk on this day, or null if it doesn't (FR-3.4). */
function fleeceNote(date: string, ctx: RiskContext): string | null {
  if (ctx.group?.species !== 'sheep') return null;
  const shorn = ctx.group.lastShearingDate;
  if (!shorn) return 'no shearing date is recorded';
  const days = daysBetween(shorn, date);
  return days > BLOWFLY_FLEECE_DAYS ? `the flock was shorn ${days} days ago` : null;
}

function assessDay(
  day: DailyWeather,
  previous: DailyWeather | undefined,
  ctx: RiskContext,
): DailyRisk {
  let level: RiskLevel;
  let reason: string;

  if (day.tempMeanC < BLOWFLY_COLD_MEAN_C) {
    return {
      date: day.date,
      level: 'LOW',
      score: LEVEL_SCORE.LOW,
      reason: 'Too cool for much blowfly activity',
    };
  }

  if (day.tempMeanC >= BLOWFLY_WARM_MEAN_C && day.humidityMeanPct >= BLOWFLY_HUMID_PCT) {
    level = 'HIGH';
    reason = 'Warm and humid: blowfly strike risk high';
  } else {
    level = 'MEDIUM';
    reason = 'Mild conditions: some blowfly activity possible';
  }

  if (previous && previous.precipitationMm >= BLOWFLY_RAIN_MM && level !== 'HIGH') {
    level = raiseLevel(level);
    reason += '; raised because of rain the day before';
  }

  const fleece = fleeceNote(day.date, ctx);
  if (fleece && level !== 'HIGH') {
    level = raiseLevel(level);
    reason += `; raised because ${fleece}`;
  }

  return { date: day.date, level, score: LEVEL_SCORE[level], reason };
}

/** FR-5.1: general husbandry checks only. Never products, doses or withdrawal periods. */
const CHECKS: SuggestedChecks = {
  MEDIUM: [
    'Check the flock for signs of strike, such as damp or discoloured wool',
    'Keep tails and breech areas clean',
  ],
  HIGH: [
    'Check the flock daily for signs of strike',
    'Speak to your vet or adviser about flystrike prevention',
  ],
};

export const sheepBlowflyRisk: RiskModule = {
  checks: CHECKS,
  id: 'sheep-blowfly',
  name: 'Sheep blowfly strike',
  category: 'farm',
  animals: ['sheep'],
  assess(days, ctx = {}) {
    return days.map((day, i) => assessDay(day, i > 0 ? days[i - 1] : undefined, ctx));
  },
};

import { LEVEL_SCORE, raiseLevel } from '../levels';
import type { DailyRisk, DailyWeather, RiskLevel, RiskModule } from '../types';

// Heuristic thresholds. Blowfly strike risk rises in warm, humid weather,
// especially after rain.
// TODO(verify source): check against UK sheep health / flystrike guidance.
export const BLOWFLY_COLD_MEAN_C = 9;
export const BLOWFLY_WARM_MEAN_C = 15;
export const BLOWFLY_HUMID_PCT = 70;
export const BLOWFLY_RAIN_MM = 2;

function assessDay(day: DailyWeather, previous: DailyWeather | undefined): DailyRisk {
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

  return { date: day.date, level, score: LEVEL_SCORE[level], reason };
}

export const sheepBlowflyRisk: RiskModule = {
  id: 'sheep-blowfly',
  name: 'Sheep blowfly strike',
  category: 'farm',
  animals: ['sheep'],
  assess(days) {
    return days.map((day, i) => assessDay(day, i > 0 ? days[i - 1] : undefined));
  },
};

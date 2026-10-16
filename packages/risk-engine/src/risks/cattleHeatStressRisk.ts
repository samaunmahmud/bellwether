import { clampScore } from '../levels';
import type { DailyRisk, DailyWeather, RiskLevel, RiskModule } from '../types';

// Band thresholds vary in the literature (dairy cattle are often given lower ones).
// TODO(verify source): confirm which THI bands to use and cite them in the README.
export const THI_MEDIUM = 68;
export const THI_HIGH = 72;

// Range used to map THI onto the 0–100 chart score.
const THI_SCORE_MIN = 55;
const THI_SCORE_MAX = 85;

/**
 * Temperature-Humidity Index.
 * THI = (1.8T + 32) - (0.55 - 0.0055RH)(1.8T - 26), with T in °C and RH in %.
 */
export function calculateTHI(tempC: number, humidityPct: number): number {
  return 1.8 * tempC + 32 - (0.55 - 0.0055 * humidityPct) * (1.8 * tempC - 26);
}

function assessDay(day: DailyWeather): DailyRisk {
  const thi = calculateTHI(day.tempMaxC, day.humidityMeanPct);
  const shown = thi.toFixed(1);

  let level: RiskLevel;
  let reason: string;
  if (thi < THI_MEDIUM) {
    level = 'LOW';
    reason = `THI ${shown}: heat stress unlikely`;
  } else if (thi < THI_HIGH) {
    level = 'MEDIUM';
    reason = `THI ${shown}: mild heat stress possible`;
  } else {
    level = 'HIGH';
    reason = `THI ${shown}: heat stress likely`;
  }

  const score = clampScore(((thi - THI_SCORE_MIN) / (THI_SCORE_MAX - THI_SCORE_MIN)) * 100);
  return { date: day.date, level, score, reason };
}

export const cattleHeatStressRisk: RiskModule = {
  id: 'cattle-heat-stress',
  name: 'Cattle heat stress',
  category: 'farm',
  animals: ['cattle'],
  assess(days) {
    return days.map(assessDay);
  },
};

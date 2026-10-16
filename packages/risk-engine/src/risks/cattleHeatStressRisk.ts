import { clampScore } from '../levels';
import type {
  DailyRisk,
  DailyWeather,
  HourlyWeather,
  RiskContext,
  RiskLevel,
  RiskModule,
} from '../types';

// Band thresholds vary in the literature (dairy cattle are often given lower ones).
// heuristic TODO(verify source): confirm which THI bands to use and cite them in the README.
export const THI_MEDIUM = 68;
export const THI_HIGH = 72;

// Range used to map THI onto the 0–100 chart score.
const THI_SCORE_MIN = 55;
const THI_SCORE_MAX = 85;

const HOUSED_NOTE = ' (housed: shed conditions may differ from outdoor weather)';

/**
 * Temperature-Humidity Index.
 * THI = (1.8T + 32) - (0.55 - 0.0055RH)(1.8T - 26), with T in °C and RH in %.
 */
export function calculateTHI(tempC: number, humidityPct: number): number {
  return 1.8 * tempC + 32 - (0.55 - 0.0055 * humidityPct) * (1.8 * tempC - 26);
}

function levelFor(thi: number): RiskLevel {
  if (thi < THI_MEDIUM) return 'LOW';
  return thi < THI_HIGH ? 'MEDIUM' : 'HIGH';
}

const OUTCOME: Record<RiskLevel, string> = {
  LOW: 'heat stress unlikely',
  MEDIUM: 'mild heat stress possible',
  HIGH: 'heat stress likely',
};

const scoreFor = (thi: number) =>
  clampScore(((thi - THI_SCORE_MIN) / (THI_SCORE_MAX - THI_SCORE_MIN)) * 100);

/** "2026-07-01T15:00" → "3pm" */
function clockHour(time: string): string {
  const hour = Number(time.slice(11, 13));
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${hour < 12 ? 'am' : 'pm'}`;
}

/** Daily maximum temperature with mean humidity, when there is no hourly data. */
function assessDaily(day: DailyWeather): DailyRisk {
  const thi = calculateTHI(day.tempMaxC, day.humidityMeanPct);
  const level = levelFor(thi);
  return {
    date: day.date,
    level,
    score: scoreFor(thi),
    reason: `THI ${thi.toFixed(1)}: ${OUTCOME[level]}`,
  };
}

/**
 * FR-3.1: peak hourly THI and the number of hours at or above the High threshold.
 * Each hour's THI is rounded to one decimal place first, so the numbers shown always agree
 * with the level (an hour shown as "72.0" counts as at or above 72).
 */
function assessHourly(day: DailyWeather, hours: HourlyWeather[]): DailyRisk {
  const thiValues = hours.map((h) => Math.round(calculateTHI(h.tempC, h.humidityPct) * 10) / 10);
  const peak = Math.max(...thiValues);
  const peakHour = hours[thiValues.indexOf(peak)]!;
  const hot = thiValues.filter((t) => t >= THI_HIGH).length;
  const level = levelFor(peak);

  let reason = `Peak THI ${peak.toFixed(1)} around ${clockHour(peakHour.time)}`;
  if (hot > 0) reason += `; ${hot} ${hot === 1 ? 'hour' : 'hours'} at or above ${THI_HIGH}`;
  reason += `: ${OUTCOME[level]}`;

  return { date: day.date, level, score: scoreFor(peak), reason };
}

function assessDay(day: DailyWeather, ctx: RiskContext): DailyRisk {
  const result = day.hours?.length ? assessHourly(day, day.hours) : assessDaily(day);
  if (ctx.group?.housed) result.reason += HOUSED_NOTE;
  return result;
}

export const cattleHeatStressRisk: RiskModule = {
  id: 'cattle-heat-stress',
  name: 'Cattle heat stress',
  category: 'farm',
  animals: ['cattle'],
  assess(days, ctx = {}) {
    return days.map((day) => assessDay(day, ctx));
  },
};

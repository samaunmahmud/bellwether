import { LEVEL_SCORE } from '../levels';
import type { DailyRisk, DailyWeather, RiskModule, SuggestedChecks } from '../types';

// Heuristic thresholds based on the day's maximum temperature.
// heuristic TODO(verify source): check against UK veterinary guidance on dogs in hot weather.
export const HEATSTROKE_MEDIUM_MAX_C = 20;
export const HEATSTROKE_HIGH_MAX_C = 25;

function assessDay(day: DailyWeather): DailyRisk {
  if (day.tempMaxC < HEATSTROKE_MEDIUM_MAX_C) {
    return {
      date: day.date,
      level: 'LOW',
      score: LEVEL_SCORE.LOW,
      reason: 'Cool enough for normal walks',
    };
  }
  if (day.tempMaxC <= HEATSTROKE_HIGH_MAX_C) {
    return {
      date: day.date,
      level: 'MEDIUM',
      score: LEVEL_SCORE.MEDIUM,
      reason: 'Warm day: consider walking in cooler hours',
    };
  }
  return {
    date: day.date,
    level: 'HIGH',
    score: LEVEL_SCORE.HIGH,
    reason: 'Hot day: walk early morning or evening and keep exercise light',
  };
}

/** FR-5.1: general husbandry checks only. Never products, doses or withdrawal periods. */
const CHECKS: SuggestedChecks = {
  MEDIUM: ['Walk in the cooler parts of the day', 'Make sure fresh water is always available'],
  HIGH: [
    'Walk only in the early morning or late evening',
    'Never leave your dog in a car or conservatory',
    'Provide shade and fresh water at all times',
  ],
};

export const dogHeatstrokeRisk: RiskModule = {
  checks: CHECKS,
  id: 'dog-heatstroke',
  name: 'Dog heatstroke',
  category: 'pet',
  animals: ['dog'],
  assess(days) {
    return days.map(assessDay);
  },
};

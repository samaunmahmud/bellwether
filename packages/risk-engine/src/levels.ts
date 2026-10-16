import type { RiskLevel } from './types';

const ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

/** Default chart score for each level, used by modules without a continuous score. */
export const LEVEL_SCORE: Record<RiskLevel, number> = {
  LOW: 15,
  MEDIUM: 50,
  HIGH: 85,
};

/** Raise a risk level by one step, capped at HIGH. */
export function raiseLevel(level: RiskLevel): RiskLevel {
  const index = ORDER.indexOf(level);
  return ORDER[Math.min(index + 1, ORDER.length - 1)] as RiskLevel;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

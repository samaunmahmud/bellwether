import { cattleHeatStressRisk } from './risks/cattleHeatStressRisk';
import { dogHeatstrokeRisk } from './risks/dogHeatstrokeRisk';
import { sheepBlowflyRisk } from './risks/sheepBlowflyRisk';
import { tickRisk } from './risks/tickRisk';
import type { AnimalCategory, RiskModule } from './types';

/**
 * Every risk module the app knows about.
 * To add a new risk: create a file in ./risks, add it here, and write its tests.
 */
export const riskModules: readonly RiskModule[] = [
  tickRisk,
  dogHeatstrokeRisk,
  cattleHeatStressRisk,
  sheepBlowflyRisk,
];

export function getRiskModules(category?: AnimalCategory): RiskModule[] {
  return riskModules.filter((m) => category === undefined || m.category === category);
}

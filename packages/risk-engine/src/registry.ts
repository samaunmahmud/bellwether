import { cattleHeatStressRisk } from './risks/cattleHeatStressRisk';
import { dogHeatstrokeRisk } from './risks/dogHeatstrokeRisk';
import { lambChillRisk } from './risks/lambChillRisk';
import { sheepBlowflyRisk } from './risks/sheepBlowflyRisk';
import { tickRisk } from './risks/tickRisk';
import type { AnimalCategory, DailyWeather, DateRange, RiskContext, RiskModule } from './types';

/**
 * Every risk module the app knows about.
 * To add a new risk: create a file in ./risks, add it here, and write its tests.
 */
export const riskModules: readonly RiskModule[] = [
  tickRisk,
  dogHeatstrokeRisk,
  cattleHeatStressRisk,
  sheepBlowflyRisk,
  lambChillRisk,
];

export function getRiskModules(category?: AnimalCategory): RiskModule[] {
  return riskModules.filter((m) => category === undefined || m.category === category);
}

/**
 * FR-3.0: the farm modules for a livestock group: those for its species that say they apply
 * (e.g. lamb chill only during lambing).
 */
export function modulesForGroup(
  ctx: RiskContext & { group: NonNullable<RiskContext['group']> },
  days: DailyWeather[],
): RiskModule[] {
  return getRiskModules('farm').filter(
    (m) => m.animals.includes(ctx.group.species) && (m.appliesTo?.(ctx, days) ?? true),
  );
}

/** FR-3.0: one date range covering all the past weather the given modules need, or null. */
export function historyRangeFor(
  modules: readonly RiskModule[],
  firstForecastDay: string,
): DateRange | null {
  const ranges = modules
    .map((m) => m.historyRange?.(firstForecastDay) ?? null)
    .filter((r): r is DateRange => r !== null);
  if (ranges.length === 0) return null;
  return {
    start: ranges.map((r) => r.start).sort()[0]!,
    end: ranges
      .map((r) => r.end)
      .sort()
      .at(-1)!,
  };
}

import type { RiskLevel, RiskModule } from './types';

/** FR-5.1: the module's suggested checks for a level. Nothing is suggested at LOW. */
export function suggestedChecks(module: RiskModule, level: RiskLevel): string[] {
  return level === 'LOW' ? [] : [...(module.checks?.[level] ?? [])];
}

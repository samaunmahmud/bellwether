import { describe, expect, it } from 'vitest';
import { suggestedChecks } from '../src/checks';
import { riskModules } from '../src/registry';

// Hard rule: suggested checks are general husbandry only, never dosing advice.
const DOSING = /dose|mg|ml\/kg/i;

describe('suggested checks (FR-5.1)', () => {
  describe.each(riskModules.map((m) => [m.id, m] as const))('%s', (_id, module) => {
    it('has at least one check for MEDIUM and for HIGH', () => {
      expect(suggestedChecks(module, 'MEDIUM').length).toBeGreaterThan(0);
      expect(suggestedChecks(module, 'HIGH').length).toBeGreaterThan(0);
    });

    it('suggests nothing for LOW', () => {
      expect(suggestedChecks(module, 'LOW')).toEqual([]);
    });

    it('never mentions doses, mg or ml/kg', () => {
      for (const check of [
        ...suggestedChecks(module, 'MEDIUM'),
        ...suggestedChecks(module, 'HIGH'),
      ]) {
        expect(check).not.toMatch(DOSING);
      }
    });

    it('writes each check as a short, complete sentence', () => {
      for (const check of [
        ...suggestedChecks(module, 'MEDIUM'),
        ...suggestedChecks(module, 'HIGH'),
      ]) {
        expect(check).toMatch(/^[A-Z]/);
        expect(check.length).toBeLessThanOrEqual(100);
        expect(check).not.toMatch(/\.$/);
      }
    });
  });

  it('suggests nothing for a module without checks', () => {
    const bare = { ...riskModules[0]!, checks: undefined };
    expect(suggestedChecks(bare, 'HIGH')).toEqual([]);
  });

  it('the dosing guard itself catches the banned words', () => {
    for (const bad of ['Give a dose of', '5 mg', '2 ML/KG']) expect(bad).toMatch(DOSING);
  });
});

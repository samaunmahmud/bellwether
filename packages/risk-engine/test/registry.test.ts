import { describe, expect, it } from 'vitest';
import { raiseLevel } from '../src/levels';
import { getRiskModules, riskModules } from '../src/registry';
import { day } from './helpers';

describe('registry', () => {
  it('has unique ids', () => {
    const ids = riskModules.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('filters by category', () => {
    expect(getRiskModules('pet').map((m) => m.id)).toEqual(['tick', 'dog-heatstroke']);
    expect(getRiskModules('farm').map((m) => m.id)).toEqual([
      'cattle-heat-stress',
      'sheep-blowfly',
      'lamb-chill',
      'liver-fluke',
    ]);
    expect(getRiskModules()).toHaveLength(riskModules.length);
  });

  // Run every module over a wide range of weather to make sure the contract holds.
  const weatherSamples = [-5, 0, 5, 10, 15, 20, 25, 30, 35].flatMap((temp) =>
    [30, 60, 80, 100].map((humidity, i) =>
      day({
        date: `2026-07-${String(i + 1).padStart(2, '0')}`,
        tempMeanC: temp,
        tempMaxC: temp + 5,
        tempMinC: temp - 5,
        humidityMeanPct: humidity,
        precipitationMm: i % 2 === 0 ? 5 : 0,
      }),
    ),
  );

  describe.each(riskModules.map((m) => [m.id, m] as const))('%s', (_id, module) => {
    it('implements the RiskModule shape', () => {
      expect(module.name.length).toBeGreaterThan(0);
      expect(['pet', 'farm']).toContain(module.category);
      expect(module.animals.length).toBeGreaterThan(0);
    });

    it('returns one valid result per day, each with a reason', () => {
      const results = module.assess(weatherSamples, { highExposureHabitat: true });
      expect(results).toHaveLength(weatherSamples.length);
      for (const r of results) {
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(r.level);
        expect(r.reason.trim().length).toBeGreaterThan(0);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    });

    it('returns an empty list for no days', () => {
      expect(module.assess([])).toEqual([]);
    });
  });
});

describe('raiseLevel', () => {
  it('steps up one level and caps at HIGH', () => {
    expect(raiseLevel('LOW')).toBe('MEDIUM');
    expect(raiseLevel('MEDIUM')).toBe('HIGH');
    expect(raiseLevel('HIGH')).toBe('HIGH');
  });
});

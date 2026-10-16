import { describe, expect, it } from 'vitest';
import { sheepBlowflyRisk } from '../src/risks/sheepBlowflyRisk';
import type { RiskContext } from '../src/types';
import { day } from './helpers';

// A mild day that is MEDIUM on weather alone.
const MILD = { date: '2026-07-01', tempMeanC: 12, humidityMeanPct: 50 };

const sheep = (lastShearingDate: string | null): RiskContext => ({
  group: { species: 'sheep', lastShearingDate },
});

const assess = (ctx: RiskContext, overrides = MILD) =>
  sheepBlowflyRisk.assess([day(overrides)], ctx)[0]!;

describe('sheepBlowflyRisk fleece rule (FR-3.4)', () => {
  describe('days since shearing (more than 42 raises)', () => {
    it('does not raise at 41 days', () => {
      expect(assess(sheep('2026-05-21')).level).toBe('MEDIUM');
    });

    it('does not raise at exactly 42 days', () => {
      expect(assess(sheep('2026-05-20')).level).toBe('MEDIUM');
    });

    it('raises at 43 days and says why', () => {
      const result = assess(sheep('2026-05-19'));
      expect(result.level).toBe('HIGH');
      expect(result.reason).toMatch(/raised because the flock was shorn 43 days ago/);
    });
  });

  it('raises when no shearing date is recorded', () => {
    const result = assess(sheep(null));
    expect(result.level).toBe('HIGH');
    expect(result.reason).toMatch(/raised because no shearing date is recorded/);
  });

  it('raises when the last shearing was last season', () => {
    expect(assess(sheep('2025-06-15')).level).toBe('HIGH');
  });

  it('measures from each forecast day, so risk can rise during the forecast', () => {
    const [before, after] = sheepBlowflyRisk.assess(
      [day({ ...MILD, date: '2026-07-01' }), day({ ...MILD, date: '2026-07-02' })],
      sheep('2026-05-20'),
    );
    expect(before!.level).toBe('MEDIUM'); // 42 days
    expect(after!.level).toBe('HIGH'); // 43 days
  });

  it('leaves cold days LOW', () => {
    expect(assess(sheep(null), { ...MILD, tempMeanC: 5 }).level).toBe('LOW');
  });

  it('does not add a fleece note to a day that is already HIGH', () => {
    const result = assess(sheep(null), { ...MILD, tempMeanC: 18, humidityMeanPct: 80 });
    expect(result.level).toBe('HIGH');
    expect(result.reason).not.toMatch(/shear/);
  });

  it('does nothing without group details', () => {
    expect(assess({}).level).toBe('MEDIUM');
  });
});

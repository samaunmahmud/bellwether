import type { DailyRisk, RiskLevel } from '@bellwether/risk-engine';
import { describe, expect, it } from 'vitest';
import { buildBriefing, type BriefingContent, type GroupForBriefing } from '../src/domain/briefing';

const TODAY = '2026-06-10';

/** Daily risks starting on `start`, one per level given. */
function days(levels: RiskLevel[], start = TODAY): DailyRisk[] {
  return levels.map((level, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), level, score: 50, reason: `${level} reason ${i}` };
  });
}

const checks = { MEDIUM: ['Medium check'], HIGH: ['High check A', 'High check B'] };

function group(
  id: string,
  risks: Array<{ riskId: string; levels: RiskLevel[]; start?: string }>,
): GroupForBriefing {
  return {
    groupId: id,
    groupName: `Group ${id}`,
    fieldName: 'Top field',
    risks: risks.map((r) => ({
      riskId: r.riskId,
      riskName: `Risk ${r.riskId}`,
      days: days(r.levels, r.start),
      checks,
    })),
  };
}

const build = (groups: GroupForBriefing[], previous: BriefingContent | null = null) =>
  buildBriefing({ date: TODAY, generatedAt: '2026-06-10T05:00:00.000Z', groups, previous });

describe('buildBriefing (FR-4.1, FR-4.2)', () => {
  it('lists Medium and High risks with everything a farmer needs', () => {
    const briefing = build([
      group('g1', [{ riskId: 'blowfly', levels: ['LOW', 'MEDIUM', 'HIGH', 'HIGH'] }]),
    ]);
    expect(briefing.groups).toEqual([
      {
        groupId: 'g1',
        groupName: 'Group g1',
        fieldName: 'Top field',
        items: [
          {
            riskId: 'blowfly',
            riskName: 'Risk blowfly',
            level: 'HIGH',
            daysAffected: [
              { date: '2026-06-11', level: 'MEDIUM' },
              { date: '2026-06-12', level: 'HIGH' },
              { date: '2026-06-13', level: 'HIGH' },
            ],
            // The reason from the first day at the highest level
            reason: 'HIGH reason 2',
            checks: ['High check A', 'High check B'],
            isNew: false,
          },
        ],
      },
    ]);
  });

  it('leaves out risks that stay Low', () => {
    const briefing = build([
      group('g1', [
        { riskId: 'quiet', levels: ['LOW', 'LOW'] },
        { riskId: 'busy', levels: ['MEDIUM'] },
      ]),
    ]);
    expect(briefing.groups[0]!.items.map((i) => i.riskId)).toEqual(['busy']);
  });

  it('collapses groups with nothing to flag into "No concerns this week"', () => {
    const briefing = build([
      group('g1', [{ riskId: 'quiet', levels: ['LOW'] }]),
      group('g2', [{ riskId: 'busy', levels: ['MEDIUM'] }]),
    ]);
    expect(briefing.groups.map((g) => g.groupId)).toEqual(['g2']);
    expect(briefing.quietGroups).toEqual([{ groupId: 'g1', groupName: 'Group g1' }]);
  });

  describe('looks at the next 7 days only', () => {
    it('includes today and today + 6, but not today + 7 or earlier days', () => {
      const briefing = build([
        group('g1', [
          {
            riskId: 'edge',
            levels: ['MEDIUM', ...Array(5).fill('LOW'), 'HIGH', 'HIGH'] as RiskLevel[],
          },
          { riskId: 'past', levels: ['HIGH', 'LOW'], start: '2026-06-09' },
        ]),
      ]);
      const edge = briefing.groups[0]!.items.find((i) => i.riskId === 'edge')!;
      expect(edge.daysAffected.map((d) => d.date)).toEqual(['2026-06-10', '2026-06-16']);
      expect(briefing.groups[0]!.items.map((i) => i.riskId)).not.toContain('past');
    });
  });

  it('sorts by severity, then by the first day affected', () => {
    const briefing = build([
      group('g1', [
        { riskId: 'medium-early', levels: ['MEDIUM'] },
        { riskId: 'high-late', levels: ['LOW', 'LOW', 'HIGH'] },
        { riskId: 'high-early', levels: ['LOW', 'HIGH'] },
      ]),
    ]);
    expect(briefing.groups[0]!.items.map((i) => i.riskId)).toEqual([
      'high-early',
      'high-late',
      'medium-early',
    ]);
  });

  it('puts groups with High risks first, then by name', () => {
    const briefing = build([
      group('b', [{ riskId: 'r', levels: ['MEDIUM'] }]),
      group('c', [{ riskId: 'r', levels: ['HIGH'] }]),
      group('a', [{ riskId: 'r', levels: ['MEDIUM'] }]),
    ]);
    expect(briefing.groups.map((g) => g.groupId)).toEqual(['c', 'a', 'b']);
  });

  it('counts what was flagged, for deciding whether to email', () => {
    expect(build([group('g1', [{ riskId: 'r', levels: ['LOW'] }])]).flaggedCount).toBe(0);
    expect(
      build([
        group('g1', [
          { riskId: 'r', levels: ['HIGH'] },
          { riskId: 's', levels: ['MEDIUM'] },
        ]),
      ]).flaggedCount,
    ).toBe(2);
  });
});

describe('"New" Highs (FR-4.4 acceptance)', () => {
  const yesterdayRun = (level: RiskLevel | null): BriefingContent =>
    buildBriefing({
      date: '2026-06-09',
      generatedAt: '2026-06-09T05:00:00.000Z',
      groups: [
        group('g1', level ? [{ riskId: 'blowfly', levels: [level], start: '2026-06-09' }] : []),
      ],
      previous: null,
    });

  const todayHigh = [group('g1', [{ riskId: 'blowfly', levels: ['HIGH'] }])];
  const isNew = (b: BriefingContent) => b.groups[0]!.items[0]!.isNew;

  it('yesterday Medium → today High is New', () => {
    expect(isNew(build(todayHigh, yesterdayRun('MEDIUM')))).toBe(true);
  });

  it('yesterday High → today High is not New', () => {
    expect(isNew(build(todayHigh, yesterdayRun('HIGH')))).toBe(false);
  });

  it('a High that wasn’t flagged at all yesterday is New', () => {
    expect(isNew(build(todayHigh, yesterdayRun(null)))).toBe(true);
    expect(isNew(build(todayHigh, yesterdayRun('LOW')))).toBe(true);
  });

  it('nothing is New without a run from yesterday', () => {
    expect(isNew(build(todayHigh, null))).toBe(false);
    const twoDaysAgo = { ...yesterdayRun('MEDIUM'), date: '2026-06-08' };
    expect(isNew(build(todayHigh, twoDaysAgo))).toBe(false);
  });

  it('a Medium is never New', () => {
    const todayMedium = [group('g1', [{ riskId: 'blowfly', levels: ['MEDIUM'] }])];
    expect(isNew(build(todayMedium, yesterdayRun('LOW')))).toBe(false);
  });
});

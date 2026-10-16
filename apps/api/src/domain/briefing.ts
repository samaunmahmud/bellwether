import {
  addDays,
  type DailyRisk,
  type RiskLevel,
  type SuggestedChecks,
} from '@bellwether/risk-engine';

/** How far ahead the briefing looks (FR-4.1). */
export const BRIEFING_DAYS = 7;

const SEVERITY: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** One livestock group's forecast, as the briefing needs it. */
export interface GroupForBriefing {
  groupId: string;
  groupName: string;
  fieldName: string | null;
  risks: Array<{
    riskId: string;
    riskName: string;
    days: DailyRisk[];
    checks: SuggestedChecks;
  }>;
}

/** FR-4.2: one flagged risk for one group. */
export interface BriefingItem {
  riskId: string;
  riskName: string;
  /** The highest level in the next 7 days */
  level: RiskLevel;
  /** The days at Medium or High */
  daysAffected: Array<{ date: string; level: RiskLevel }>;
  /** The reason from the first day at the highest level */
  reason: string;
  checks: string[];
  /** FR-4.4: High today, but not High in yesterday's run */
  isNew: boolean;
}

export interface BriefingGroup {
  groupId: string;
  groupName: string;
  fieldName: string | null;
  items: BriefingItem[];
}

/** What a stored briefing run contains (FR-4.5). */
export interface BriefingContent {
  /** UK date the briefing is for */
  date: string;
  generatedAt: string;
  /** Groups with something flagged, most severe first */
  groups: BriefingGroup[];
  /** FR-4.1: groups with nothing to flag, shown as "No concerns this week" */
  quietGroups: Array<{ groupId: string; groupName: string }>;
  flaggedCount: number;
}

const bySeverityThenDate = (a: BriefingItem, b: BriefingItem) =>
  SEVERITY[b.level] - SEVERITY[a.level] ||
  a.daysAffected[0]!.date.localeCompare(b.daysAffected[0]!.date);

function itemFor(
  risk: GroupForBriefing['risks'][number],
  windowStart: string,
  windowEnd: string,
): Omit<BriefingItem, 'isNew'> | null {
  const flagged = risk.days.filter(
    (d) => d.date >= windowStart && d.date < windowEnd && d.level !== 'LOW',
  );
  if (flagged.length === 0) return null;

  const level = flagged.some((d) => d.level === 'HIGH') ? 'HIGH' : 'MEDIUM';
  const worst = flagged.find((d) => d.level === level)!;
  return {
    riskId: risk.riskId,
    riskName: risk.riskName,
    level,
    daysAffected: flagged.map((d) => ({ date: d.date, level: d.level })),
    reason: worst.reason,
    checks: [...risk.checks[level]],
  };
}

/** The level each (group, risk) had in a previous run. */
function previousLevels(previous: BriefingContent | null, yesterday: string) {
  const levels = new Map<string, RiskLevel>();
  if (previous?.date !== yesterday) return null;
  for (const g of previous.groups) {
    for (const item of g.items) levels.set(`${g.groupId}:${item.riskId}`, item.level);
  }
  return levels;
}

/**
 * FR-4.1, FR-4.2, FR-4.4: builds a farm's briefing for `date` from each group's forecast.
 * An item is "New" when it is High today and was not High in yesterday's run; with no run
 * from yesterday, nothing is marked New (docs/decisions.md).
 */
export function buildBriefing(input: {
  date: string;
  generatedAt: string;
  groups: GroupForBriefing[];
  previous: BriefingContent | null;
}): BriefingContent {
  const windowEnd = addDays(input.date, BRIEFING_DAYS);
  const yesterdayLevels = previousLevels(input.previous, addDays(input.date, -1));

  const flagged: BriefingGroup[] = [];
  const quietGroups: BriefingContent['quietGroups'] = [];

  for (const group of input.groups) {
    const items = group.risks
      .map((risk) => itemFor(risk, input.date, windowEnd))
      .filter((item): item is Omit<BriefingItem, 'isNew'> => item !== null)
      .map((item) => ({
        ...item,
        isNew:
          item.level === 'HIGH' &&
          yesterdayLevels !== null &&
          yesterdayLevels.get(`${group.groupId}:${item.riskId}`) !== 'HIGH',
      }))
      .sort(bySeverityThenDate);

    if (items.length === 0)
      quietGroups.push({ groupId: group.groupId, groupName: group.groupName });
    else
      flagged.push({
        groupId: group.groupId,
        groupName: group.groupName,
        fieldName: group.fieldName,
        items,
      });
  }

  flagged.sort(
    (a, b) =>
      SEVERITY[b.items[0]!.level] - SEVERITY[a.items[0]!.level] ||
      a.groupName.localeCompare(b.groupName),
  );

  return {
    date: input.date,
    generatedAt: input.generatedAt,
    groups: flagged,
    quietGroups,
    flaggedCount: flagged.reduce((n, g) => n + g.items.length, 0),
  };
}

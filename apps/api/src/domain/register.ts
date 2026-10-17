import { daysBetween } from '@bellwether/risk-engine';

/**
 * v3 holding register: births, deaths, movements on and off the holding, weighings,
 * faecal egg counts, body condition scores, tag replacements and head counts.
 * One event type covers them all so the register can be read as one running record.
 */
export type RegisterEventKind =
  | 'BIRTH'
  | 'DEATH'
  | 'MOVE_ON'
  | 'MOVE_OFF'
  | 'WEIGHING'
  | 'FEC'
  | 'BODY_CONDITION'
  | 'TAG_REPLACEMENT'
  | 'HEAD_COUNT';

export const REGISTER_EVENT_KINDS: readonly RegisterEventKind[] = [
  'BIRTH',
  'DEATH',
  'MOVE_ON',
  'MOVE_OFF',
  'WEIGHING',
  'FEC',
  'BODY_CONDITION',
  'TAG_REPLACEMENT',
  'HEAD_COUNT',
];

export interface RegisterEvent {
  id: string;
  farmId: string;
  groupId: string;
  kind: RegisterEventKind;
  /** YYYY-MM-DD */
  date: string;
  /**
   * Births: born alive. Deaths, moves, tag replacements: animals. Weighing, FEC, condition:
   * animals weighed or sampled. Head count: the counted total.
   */
  count: number | null;
  /** Births only */
  bornDead: number | null;
  /** Weighing: average kg. FEC: eggs per gram. Body condition: average score (1–5). */
  value: number | null;
  /** Moves: the other holding, market or abattoir (name and/or CPH) */
  otherParty: string | null;
  /** Movement licence, fallen-stock collection or lab reference */
  reference: string | null;
  /** Deaths only */
  cause: string | null;
  note: string | null;
  /** Email of whoever recorded it, at the time */
  recordedBy: string;
  /** ISO timestamp */
  recordedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

/**
 * How an event changes the group's head count. `set` replaces it (the 1 December count);
 * `delta` adds to it. Measurements don't change it.
 */
export function headCountEffect(
  event: Pick<RegisterEvent, 'kind' | 'count'>,
): { delta: number } | { set: number } | null {
  const n = event.count ?? 0;
  switch (event.kind) {
    case 'BIRTH':
    case 'MOVE_ON':
      return { delta: n };
    case 'DEATH':
    case 'MOVE_OFF':
      return { delta: -n };
    case 'HEAD_COUNT':
      return { set: n };
    default:
      return null;
  }
}

/** A product in the farm's medicine cabinet, typed by the farmer from the label. */
export interface MedicineItem {
  id: string;
  farmId: string;
  productName: string;
  batchNumber: string | null;
  /** Free text, e.g. "2 × 500 ml" */
  quantity: string | null;
  /** YYYY-MM-DD */
  expiryDate: string | null;
  supplier: string | null;
  purchasedOn: string | null;
  /** From the label, to fill in the treatment form; never suggested by Bellwether */
  meatWithdrawalDays: number | null;
  milkWithdrawalDays: number | null;
  note: string | null;
  /** Used up or thrown away */
  finishedOn: string | null;
}

/** Events that belong in the holding register (measurements are kept elsewhere). */
export const REGISTER_KINDS: ReadonlySet<RegisterEventKind> = new Set([
  'BIRTH',
  'DEATH',
  'MOVE_ON',
  'MOVE_OFF',
  'TAG_REPLACEMENT',
  'HEAD_COUNT',
]);

/**
 * The holding register, newest first, with each group's head count straight after each event.
 * Worked backwards from today's head counts; before a recorded head count the earlier totals
 * can't be known, so they are null.
 */
export function registerRows(
  events: RegisterEvent[],
  currentHeadCounts: ReadonlyMap<string, number>,
): Array<{ event: RegisterEvent; headCountAfter: number | null }> {
  const running = new Map<string, number | null>(currentHeadCounts);
  return events
    .filter((e) => !e.voidedAt && REGISTER_KINDS.has(e.kind))
    .map((event) => {
      const after = running.get(event.groupId) ?? null;
      const effect = headCountEffect(event);
      if (effect && 'set' in effect) running.set(event.groupId, null);
      else if (effect && after !== null) running.set(event.groupId, after - effect.delta);
      return { event, headCountAfter: effect && 'set' in effect ? effect.set : after };
    });
}

export interface WeightPoint {
  date: string;
  averageKg: number;
  /** Average daily live-weight gain since the previous weighing, kg/day, 2 dp */
  dailyGainKg: number | null;
}

const round = (value: number, dp: number) => Math.round(value * 10 ** dp) / 10 ** dp;

/** A group's weighings, oldest first, with daily live-weight gain (DLWG) between them. */
export function weightPoints(events: RegisterEvent[]): WeightPoint[] {
  const weighings = events
    .filter((e) => e.kind === 'WEIGHING' && !e.voidedAt && e.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return weighings.map((e, i) => {
    const previous = weighings[i - 1];
    const days = previous ? daysBetween(previous.date, e.date) : 0;
    return {
      date: e.date,
      averageKg: e.value!,
      dailyGainKg: previous && days > 0 ? round((e.value! - previous.value!) / days, 2) : null,
    };
  });
}

export interface FarmStats {
  totalHead: number;
  sheep: number;
  cattle: number;
  bornAlive: number;
  bornDead: number;
  deaths: number;
  movedOn: number;
  movedOff: number;
  /** Deaths as a % of animals kept over the 12 months (1 dp), or null with none kept */
  mortalityPct: number | null;
  /** Born alive as a % of all born (1 dp), or null with no births */
  birthSurvivalPct: number | null;
}

/**
 * Twelve-month figures for the dashboard. "Animals kept" is the head count a year ago
 * (worked back from today) plus everything born or moved on since.
 */
export function farmStats(
  groups: Array<{ species: 'SHEEP' | 'CATTLE'; headCount: number }>,
  events: RegisterEvent[],
  since: string,
): FarmStats {
  const sum = (
    kind: RegisterEventKind,
    pick: (e: RegisterEvent) => number | null = (e) => e.count,
  ) =>
    events
      .filter((e) => e.kind === kind && !e.voidedAt && e.date >= since)
      .reduce((total, e) => total + (pick(e) ?? 0), 0);
  const head = (species: 'SHEEP' | 'CATTLE') =>
    groups.filter((g) => g.species === species).reduce((t, g) => t + g.headCount, 0);

  const totalHead = head('SHEEP') + head('CATTLE');
  const bornAlive = sum('BIRTH');
  const bornDead = sum('BIRTH', (e) => e.bornDead);
  const deaths = sum('DEATH');
  const movedOn = sum('MOVE_ON');
  const movedOff = sum('MOVE_OFF');
  const atStart = totalHead - bornAlive - movedOn + deaths + movedOff;
  const kept = atStart + bornAlive + movedOn;
  return {
    totalHead,
    sheep: head('SHEEP'),
    cattle: head('CATTLE'),
    bornAlive,
    bornDead,
    deaths,
    movedOn,
    movedOff,
    mortalityPct: kept > 0 ? round((deaths / kept) * 100, 1) : null,
    birthSurvivalPct:
      bornAlive + bornDead > 0 ? round((bornAlive / (bornAlive + bornDead)) * 100, 1) : null,
  };
}

export type GrazingStatus = 'GRAZED' | 'RESTING' | 'NEVER_USED';

/**
 * How long a field has been grazed (a group in it now) or rested (since the last group left),
 * from group moves. `moves` are every move on the farm.
 */
export function grazingFor(
  fieldId: string,
  groupsInField: string[],
  moves: Array<{ fromFieldId: string | null; toFieldId: string; movedOn: string }>,
  today: string,
): { status: GrazingStatus; days: number | null; groups: string[] } {
  const into = moves.filter((m) => m.toFieldId === fieldId).map((m) => m.movedOn);
  const outOf = moves.filter((m) => m.fromFieldId === fieldId).map((m) => m.movedOn);
  if (groupsInField.length > 0) {
    const since = into.sort().at(-1);
    return {
      status: 'GRAZED',
      days: since ? daysBetween(since, today) : null,
      groups: groupsInField,
    };
  }
  const left = outOf.sort().at(-1);
  if (left) return { status: 'RESTING', days: daysBetween(left, today), groups: [] };
  return { status: into.length ? 'RESTING' : 'NEVER_USED', days: null, groups: [] };
}

import { addDays } from '@bellwether/risk-engine';

/**
 * FR-6.1: a treatment given to a livestock group (or part of one).
 * Product names and withdrawal periods are typed in by the farmer from the label or vet
 * instructions. Bellwether never suggests products, doses or withdrawal periods.
 */
export interface Treatment {
  id: string;
  farmId: string;
  groupId: string;
  date: string;
  productName: string;
  batchNumber: string | null;
  /** Free text, as written by the farmer, e.g. "250 ml" */
  quantityUsed: string | null;
  animalsTreated: number;
  administeredBy: string;
  reason: string | null;
  meatWithdrawalDays: number;
  /** Null when not applicable (e.g. not producing milk for sale) */
  milkWithdrawalDays: number | null;
  /** When it was voided (FR-6.5): kept for the audit trail, ignored for withdrawal. */
  voidedAt: string | null;
  voidReason: string | null;
}

/** FR-6.6: a check or observation, e.g. "Flock inspected" with "2 struck ewes found". */
export interface Observation {
  id: string;
  farmId: string;
  groupId: string;
  date: string;
  type: string;
  note: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export type RecordType = 'TREATMENT' | 'OBSERVATION';
export type RevisionAction = 'EDITED' | 'VOIDED';

export interface FieldChange {
  /** Human label, e.g. "Batch number" */
  field: string;
  from: string | null;
  to: string | null;
}

/** FR-6.5: one correction or void, with who, when, why and what changed. Never edited or deleted. */
export interface RecordRevision {
  id: string;
  farmId: string;
  recordId: string;
  recordType: RecordType;
  action: RevisionAction;
  reason: string;
  /** Null if the user's account has since been deleted */
  editedById: string | null;
  /** The editor's email at the time */
  editedBy: string;
  /** ISO timestamp */
  at: string;
  changes: FieldChange[];
}

/** FR-6.2: the first day the animals are out of withdrawal, or null if no period was entered. */
export function withdrawalEnds(date: string, days: number | null): string | null {
  return days === null ? null : addDays(date, days);
}

export interface WithdrawalStatus {
  inWithdrawal: boolean;
  /** Latest meat withdrawal end still in the future, or null */
  meatEnds: string | null;
  /** Latest milk withdrawal end still in the future, or null */
  milkEnds: string | null;
}

type WithdrawalInput = Pick<Treatment, 'date' | 'meatWithdrawalDays' | 'milkWithdrawalDays'> & {
  voidedAt?: string | null;
};

/**
 * FR-6.2: a group is "In withdrawal" from the treatment date up to the day before the
 * withdrawal ends. Treated 1 June with 28 days: ends 29 June, flagged up to 28 June.
 * Voided treatments (FR-6.5) don't count.
 */
export function withdrawalStatus(treatments: WithdrawalInput[], today: string): WithdrawalStatus {
  const latestActive = (pick: (t: WithdrawalInput) => number | null) =>
    treatments
      .filter((t) => !t.voidedAt && t.date <= today)
      .map((t) => withdrawalEnds(t.date, pick(t)))
      .filter((end): end is string => end !== null && end > today)
      .sort()
      .at(-1) ?? null;

  const meatEnds = latestActive((t) => t.meatWithdrawalDays);
  const milkEnds = latestActive((t) => t.milkWithdrawalDays);
  return { inWithdrawal: meatEnds !== null || milkEnds !== null, meatEnds, milkEnds };
}

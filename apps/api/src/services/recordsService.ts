import { isIsoDate, londonToday } from '../dates';
import type { LivestockGroup } from '../domain/farm';
import {
  withdrawalStatus,
  type FieldChange,
  type Observation,
  type RecordType,
  type Treatment,
} from '../domain/records';
import { appError } from '../errors';
import type { RecordsRepository } from '../repositories/recordsRepository';
import type { FarmService } from './farmService';

/** Sanity limit on withdrawal periods, to catch typos. Not a veterinary value. */
export const MAX_WITHDRAWAL_DAYS = 1000;
const MAX_TEXT = 200;
const MAX_NOTE = 1000;

export interface TreatmentInput {
  groupId: string;
  date: string;
  productName: string;
  batchNumber?: string | null;
  quantityUsed?: string | null;
  animalsTreated: number;
  administeredBy: string;
  reason?: string | null;
  meatWithdrawalDays: number;
  milkWithdrawalDays?: number | null;
}

export interface ObservationInput {
  groupId: string;
  date: string;
  type: string;
  note?: string | null;
}

/** Who is making a correction, as recorded in the history (FR-6.5). */
export interface Editor {
  id: string;
  email: string;
}

export interface Correction<T> {
  input: Partial<T>;
  reason: string;
}

type TreatmentFields = Omit<TreatmentInput, 'groupId'>;
type ObservationFields = Omit<ObservationInput, 'groupId'>;

const MAX_REASON = 500;

/** Labels for the history, in the order changes are listed. */
const TREATMENT_LABELS: Record<keyof TreatmentFields, string> = {
  date: 'Date',
  productName: 'Product name',
  batchNumber: 'Batch number',
  quantityUsed: 'Quantity used',
  animalsTreated: 'Animals treated',
  administeredBy: 'Administered by',
  reason: 'Reason',
  meatWithdrawalDays: 'Meat withdrawal (days)',
  milkWithdrawalDays: 'Milk withdrawal (days)',
};

const OBSERVATION_LABELS: Record<keyof ObservationFields, string> = {
  date: 'Date',
  type: 'Check type',
  note: 'Note',
};

const asText = (value: unknown) => (value === null || value === undefined ? null : String(value));

/** The fields that differ between two versions of a record, with human labels. */
function changesBetween<T extends object>(
  before: T,
  after: T,
  labels: Partial<Record<keyof T, string>>,
): FieldChange[] {
  return (Object.keys(labels) as Array<keyof T>)
    .filter((key) => asText(before[key]) !== asText(after[key]))
    .map((key) => ({ field: labels[key]!, from: asText(before[key]), to: asText(after[key]) }));
}

export interface RecordsServiceDeps {
  records: RecordsRepository;
  farmService: FarmService;
  now?: () => Date;
}

function required(value: string, label: string, max = MAX_TEXT): string {
  const text = value.trim();
  if (!text) throw appError('BAD_INPUT', `${label} is required`);
  if (text.length > max) throw appError('BAD_INPUT', `${label} must be ${max} characters or fewer`);
  return text;
}

function optional(value: string | null | undefined, label: string, max = MAX_TEXT): string | null {
  const text = value?.trim();
  return text ? required(text, label, max) : null;
}

function withdrawalDays(days: number, label: string): number {
  if (!Number.isInteger(days) || days < 0 || days > MAX_WITHDRAWAL_DAYS)
    throw appError(
      'BAD_INPUT',
      `${label} must be a whole number of days from 0 to ${MAX_WITHDRAWAL_DAYS}`,
    );
  return days;
}

/**
 * The fields a correction changes. Omitted fields are unchanged; null clears an optional
 * field, and is ignored for a required one (GraphQL can't tell those apart in an input).
 */
function corrected<T extends object>(input: Partial<T>, nullable: Array<keyof T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) =>
        value !== undefined && (value !== null || nullable.includes(key as keyof T)),
    ),
  ) as Partial<T>;
}

const NULLABLE_TREATMENT: Array<keyof TreatmentFields> = [
  'batchNumber',
  'quantityUsed',
  'reason',
  'milkWithdrawalDays',
];

/** Treatment records, withdrawal periods and checks (FR-6), scoped to the user's farms (FR-8.4). */
export function createRecordsService(deps: RecordsServiceDeps) {
  const { records, farmService } = deps;
  const now = deps.now ?? (() => new Date());
  const today = () => londonToday(now());

  function pastOrToday(date: string, label: string) {
    if (!isIsoDate(date))
      throw appError('BAD_INPUT', `${label} must be a date in the form YYYY-MM-DD`);
    if (date > today()) throw appError('BAD_INPUT', `${label} cannot be in the future`);
  }

  /** Recording and correcting is day-to-day work: workers and owners (FR-8.2). */
  const requireGroup = (userId: string, groupId: string) =>
    farmService.requireGroup(userId, groupId, 'work');

  /** Validates and cleans a treatment's fields, as typed in by the farmer. */
  function checkedTreatment(group: LivestockGroup, input: TreatmentFields) {
    pastOrToday(input.date, 'Treatment date');
    if (
      !Number.isInteger(input.animalsTreated) ||
      input.animalsTreated < 1 ||
      input.animalsTreated > group.headCount
    )
      throw appError(
        'BAD_INPUT',
        `Animals treated must be a whole number from 1 to the group's ${group.headCount}`,
      );
    return {
      date: input.date,
      productName: required(input.productName, 'Product name'),
      batchNumber: optional(input.batchNumber, 'Batch number'),
      quantityUsed: optional(input.quantityUsed, 'Quantity used'),
      animalsTreated: input.animalsTreated,
      administeredBy: required(input.administeredBy, 'Administered by'),
      reason: optional(input.reason, 'Reason'),
      meatWithdrawalDays: withdrawalDays(input.meatWithdrawalDays, 'Meat withdrawal'),
      milkWithdrawalDays:
        input.milkWithdrawalDays == null
          ? null
          : withdrawalDays(input.milkWithdrawalDays, 'Milk withdrawal'),
    };
  }

  function checkedObservation(input: ObservationFields) {
    pastOrToday(input.date, 'Date');
    return {
      date: input.date,
      type: required(input.type, 'Check type', 100),
      note: optional(input.note, 'Note', MAX_NOTE),
    };
  }

  const notFound = (type: RecordType, id: string) =>
    appError('NOT_FOUND', `${type === 'TREATMENT' ? 'Treatment' : 'Check'} ${id} not found`);

  const reasonFor = (reason: string) => required(reason, 'A reason for the change', MAX_REASON);

  /** The record and its group, if the editor can reach it and it hasn't been voided. */
  async function editable<T extends Treatment | Observation>(
    editor: Editor,
    id: string,
    type: RecordType,
    get: (id: string) => Promise<T | null>,
  ) {
    const record = await get(id);
    if (!record || !(await farmService.getGroup(editor.id, record.groupId)))
      throw notFound(type, id);
    const group = await requireGroup(editor.id, record.groupId);
    if (record.voidedAt) throw appError('BAD_INPUT', 'This record has been voided');
    return { record, group };
  }

  const revision = (
    editor: Editor,
    record: Treatment | Observation,
    recordType: RecordType,
    action: 'EDITED' | 'VOIDED',
    reason: string,
    changes: FieldChange[],
  ) => ({
    farmId: record.farmId,
    recordId: record.id,
    recordType,
    action,
    reason,
    editedById: editor.id,
    editedBy: editor.email,
    at: now().toISOString(),
    changes,
  });

  return {
    /** FR-6.1. Withdrawal periods are whatever the farmer copied from the label or vet (FR-6.3). */
    async recordTreatment(userId: string, input: TreatmentInput) {
      const group = await requireGroup(userId, input.groupId);
      return records.addTreatment({
        farmId: group.farmId,
        groupId: group.id,
        ...checkedTreatment(group, input),
      });
    },

    /** FR-6.6 */
    async recordObservation(userId: string, input: ObservationInput) {
      const group = await requireGroup(userId, input.groupId);
      return records.addObservation({
        farmId: group.farmId,
        groupId: group.id,
        ...checkedObservation(input),
      });
    },

    /** FR-6.5: corrects a treatment, keeping what it said before in its history. */
    async correctTreatment(editor: Editor, id: string, correction: Correction<TreatmentFields>) {
      const { record, group } = await editable(editor, id, 'TREATMENT', (i) =>
        records.getTreatment(i),
      );
      const reason = reasonFor(correction.reason);
      const after = checkedTreatment(group, {
        ...record,
        ...corrected(correction.input, NULLABLE_TREATMENT),
      });
      const changes = changesBetween<TreatmentFields>(record, after, TREATMENT_LABELS);
      if (!changes.length) throw appError('BAD_INPUT', 'Nothing was changed');
      const saved = await records.reviseTreatment(
        id,
        after,
        revision(editor, record, 'TREATMENT', 'EDITED', reason, changes),
      );
      if (!saved) throw notFound('TREATMENT', id);
      return saved;
    },

    /** FR-6.5: voids a treatment. It stays on record, marked void, and stops counting for withdrawal. */
    async voidTreatment(editor: Editor, id: string, rawReason: string) {
      const { record } = await editable(editor, id, 'TREATMENT', (i) => records.getTreatment(i));
      const reason = reasonFor(rawReason);
      const saved = await records.reviseTreatment(
        id,
        { voidedAt: now().toISOString(), voidReason: reason },
        revision(editor, record, 'TREATMENT', 'VOIDED', reason, []),
      );
      if (!saved) throw notFound('TREATMENT', id);
      return saved;
    },

    async correctObservation(
      editor: Editor,
      id: string,
      correction: Correction<ObservationFields>,
    ) {
      const { record } = await editable(editor, id, 'OBSERVATION', (i) =>
        records.getObservation(i),
      );
      const reason = reasonFor(correction.reason);
      const after = checkedObservation({ ...record, ...corrected(correction.input, ['note']) });
      const changes = changesBetween<ObservationFields>(record, after, OBSERVATION_LABELS);
      if (!changes.length) throw appError('BAD_INPUT', 'Nothing was changed');
      const saved = await records.reviseObservation(
        id,
        after,
        revision(editor, record, 'OBSERVATION', 'EDITED', reason, changes),
      );
      if (!saved) throw notFound('OBSERVATION', id);
      return saved;
    },

    async voidObservation(editor: Editor, id: string, rawReason: string) {
      const { record } = await editable(editor, id, 'OBSERVATION', (i) =>
        records.getObservation(i),
      );
      const reason = reasonFor(rawReason);
      const saved = await records.reviseObservation(
        id,
        { voidedAt: now().toISOString(), voidReason: reason },
        revision(editor, record, 'OBSERVATION', 'VOIDED', reason, []),
      );
      if (!saved) throw notFound('OBSERVATION', id);
      return saved;
    },

    /** A record's corrections and voids, newest first. Only for records the caller can already see. */
    historyFor: (recordId: string) => records.listRevisions(recordId),

    /** FR-6.4: a farm's treatments for an audit period. */
    async farmTreatments(userId: string, farmId: string, from: string, to: string) {
      if (!isIsoDate(from) || !isIsoDate(to))
        throw appError('BAD_INPUT', 'Dates must be in the form YYYY-MM-DD');
      if (to < from) throw appError('BAD_INPUT', 'The end date must be on or after the start date');
      const farm = await farmService.getFarm(userId, farmId);
      if (!farm) throw appError('NOT_FOUND', `Farm ${farmId} not found`);
      return records.listFarmTreatments(farmId, from, to);
    },

    // Children of a group the caller has already been allowed to see (GraphQL nested fields).
    treatmentsFor: (groupId: string) => records.listTreatments(groupId),
    observationsFor: (groupId: string) => records.listObservations(groupId),
    /** FR-6.2: whether the group is in withdrawal today (UK date). */
    async withdrawalFor(groupId: string) {
      return withdrawalStatus(await records.listTreatments(groupId), today());
    },
  };
}

export type RecordsService = ReturnType<typeof createRecordsService>;

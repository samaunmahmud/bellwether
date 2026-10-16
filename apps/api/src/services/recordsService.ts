import { isIsoDate, londonToday } from '../dates';
import { withdrawalStatus } from '../domain/records';
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

/** Treatment records, withdrawal periods and checks (FR-6), scoped to the user's farms (FR-8.4). */
export function createRecordsService(deps: RecordsServiceDeps) {
  const { records, farmService } = deps;
  const today = () => londonToday((deps.now ?? (() => new Date()))());

  function pastOrToday(date: string, label: string) {
    if (!isIsoDate(date))
      throw appError('BAD_INPUT', `${label} must be a date in the form YYYY-MM-DD`);
    if (date > today()) throw appError('BAD_INPUT', `${label} cannot be in the future`);
  }

  async function requireGroup(userId: string, groupId: string) {
    const group = await farmService.getGroup(userId, groupId);
    if (!group) throw appError('NOT_FOUND', `Livestock group ${groupId} not found`);
    return group;
  }

  return {
    /** FR-6.1. Withdrawal periods are whatever the farmer copied from the label or vet (FR-6.3). */
    async recordTreatment(userId: string, input: TreatmentInput) {
      const group = await requireGroup(userId, input.groupId);
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

      return records.addTreatment({
        farmId: group.farmId,
        groupId: group.id,
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
      });
    },

    /** FR-6.6 */
    async recordObservation(userId: string, input: ObservationInput) {
      const group = await requireGroup(userId, input.groupId);
      pastOrToday(input.date, 'Date');
      return records.addObservation({
        farmId: group.farmId,
        groupId: group.id,
        date: input.date,
        type: required(input.type, 'Check type', 100),
        note: optional(input.note, 'Note', MAX_NOTE),
      });
    },

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

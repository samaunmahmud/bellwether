import { addDays } from '@bellwether/risk-engine';
import { isIsoDate, londonToday } from '../dates';
import type { LivestockGroup } from '../domain/farm';
import {
  headCountEffect,
  registerRows,
  weightPoints,
  type MedicineItem,
  type RegisterEvent,
  type RegisterEventKind,
} from '../domain/register';
import { appError } from '../errors';
import type { FarmRepository } from '../repositories/farmRepository';
import type { MedicinePatch, RegisterRepository } from '../repositories/registerRepository';
import type { FarmService } from './farmService';
import { MAX_WITHDRAWAL_DAYS } from './recordsService';

const MAX_TEXT = 200;
const MAX_NOTE = 1000;
/** Sanity limits to catch typos, not veterinary values */
const MAX_WEIGHT_KG = 2000;
const MAX_EGGS_PER_GRAM = 100_000;
const MAX_BIRTHS = 10_000;
/** A medicine counts as "expiring" this many days before its expiry date */
export const EXPIRING_DAYS = 30;

export interface RegisterEventInput {
  groupId: string;
  kind: RegisterEventKind;
  date: string;
  count?: number | null;
  bornDead?: number | null;
  value?: number | null;
  otherParty?: string | null;
  reference?: string | null;
  cause?: string | null;
  note?: string | null;
}

export interface MedicineInput {
  productName?: string | null;
  batchNumber?: string | null;
  quantity?: string | null;
  expiryDate?: string | null;
  supplier?: string | null;
  purchasedOn?: string | null;
  meatWithdrawalDays?: number | null;
  milkWithdrawalDays?: number | null;
  note?: string | null;
  finishedOn?: string | null;
}

export type MedicineStatus = 'OK' | 'EXPIRING' | 'EXPIRED' | 'FINISHED';

export function medicineStatus(item: MedicineItem, today: string): MedicineStatus {
  if (item.finishedOn) return 'FINISHED';
  if (!item.expiryDate) return 'OK';
  if (item.expiryDate < today) return 'EXPIRED';
  return item.expiryDate <= addDays(today, EXPIRING_DAYS) ? 'EXPIRING' : 'OK';
}

export interface Recorder {
  id: string;
  email: string;
}

export interface RegisterServiceDeps {
  register: RegisterRepository;
  farms: FarmRepository;
  farmService: FarmService;
  now?: () => Date;
}

function text(value: string | null | undefined, label: string, max = MAX_TEXT) {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length > max)
    throw appError('BAD_INPUT', `${label} must be at most ${max} characters`);
  return trimmed || null;
}

function wholeNumber(value: number | null | undefined, label: string, min: number, max: number) {
  if (value == null || !Number.isInteger(value) || value < min || value > max)
    throw appError(
      'BAD_INPUT',
      min === 1
        ? `${label} must be at least 1 and no more than ${max}`
        : `${label} must be a whole number from ${min} to ${max}`,
    );
  return value;
}

/** Holding register (births, deaths, moves on and off, measurements) and medicine cabinet (v3). */
export function createRegisterService(deps: RegisterServiceDeps) {
  const { register, farms, farmService } = deps;
  const now = deps.now ?? (() => new Date());
  const today = () => londonToday(now());

  function pastOrToday(date: string, label: string) {
    if (!isIsoDate(date))
      throw appError('BAD_INPUT', `${label} must be a date in the form YYYY-MM-DD`);
    if (date > today()) throw appError('BAD_INPUT', `${label} cannot be in the future`);
    return date;
  }

  function optionalDate(date: string | null | undefined, label: string) {
    if (date == null || date === '') return null;
    if (!isIsoDate(date))
      throw appError('BAD_INPUT', `${label} must be a date in the form YYYY-MM-DD`);
    return date;
  }

  /** Checks the fields each kind needs; returns the cleaned event fields. */
  function checked(group: LivestockGroup, input: RegisterEventInput) {
    const base = {
      kind: input.kind,
      date: pastOrToday(input.date, 'Date'),
      count: null as number | null,
      bornDead: null as number | null,
      value: null as number | null,
      otherParty: text(input.otherParty, 'Where from or to'),
      reference: text(input.reference, 'Reference'),
      cause: null as string | null,
      note: text(input.note, 'Note', MAX_NOTE),
    };
    const sampled = () => wholeNumber(input.count ?? 1, 'Animals', 1, Math.max(group.headCount, 1));
    switch (input.kind) {
      case 'BIRTH': {
        const alive = wholeNumber(input.count ?? 0, 'Born alive', 0, MAX_BIRTHS);
        const dead = wholeNumber(input.bornDead ?? 0, 'Born dead', 0, MAX_BIRTHS);
        if (alive + dead === 0)
          throw appError('BAD_INPUT', 'Record at least one birth, alive or dead');
        return { ...base, count: alive, bornDead: dead };
      }
      case 'DEATH':
      case 'MOVE_OFF': {
        if (!Number.isInteger(input.count) || (input.count ?? 0) < 1)
          throw appError('BAD_INPUT', 'Animals must be at least 1');
        if (input.count! > group.headCount)
          throw appError(
            'BAD_INPUT',
            `That's more than the ${group.headCount} in ${group.name}. Update the head count first.`,
          );
        if (input.kind === 'MOVE_OFF' && !base.otherParty)
          throw appError('BAD_INPUT', 'Say where the animals went (holding, market or abattoir)');
        return {
          ...base,
          count: input.count!,
          cause: input.kind === 'DEATH' ? text(input.cause, 'Cause') : null,
        };
      }
      case 'MOVE_ON':
        if (!base.otherParty)
          throw appError('BAD_INPUT', 'Say where the animals came from (holding or market)');
        return { ...base, count: wholeNumber(input.count, 'Animals', 1, MAX_BIRTHS) };
      case 'TAG_REPLACEMENT':
        return { ...base, count: sampled() };
      case 'HEAD_COUNT':
        return { ...base, count: wholeNumber(input.count, 'Head count', 0, MAX_BIRTHS) };
      case 'WEIGHING':
        if (input.value == null || !(input.value > 0) || input.value > MAX_WEIGHT_KG)
          throw appError(
            'BAD_INPUT',
            `Average weight must be more than 0 and up to ${MAX_WEIGHT_KG} kg`,
          );
        return { ...base, count: sampled(), value: Math.round(input.value * 10) / 10 };
      case 'FEC':
        if (input.value == null || input.value < 0 || input.value > MAX_EGGS_PER_GRAM)
          throw appError(
            'BAD_INPUT',
            `Faecal egg count must be from 0 to ${MAX_EGGS_PER_GRAM} eggs per gram`,
          );
        return { ...base, count: sampled(), value: Math.round(input.value) };
      case 'BODY_CONDITION':
        if (input.value == null || input.value < 1 || input.value > 5)
          throw appError('BAD_INPUT', 'Body condition score must be from 1 to 5');
        return { ...base, count: sampled(), value: Math.round(input.value * 4) / 4 };
    }
  }

  /** Applies (or, with sign -1, reverses) an event's effect on its group's head count. */
  async function applyHeadCount(event: RegisterEvent, sign: 1 | -1) {
    const effect = headCountEffect(event);
    if (!effect) return;
    if ('set' in effect) {
      if (sign === 1) await farms.updateGroup(event.groupId, { headCount: effect.set });
      return;
    }
    const group = await farms.getGroup(event.groupId);
    if (!group) return;
    await farms.updateGroup(group.id, {
      headCount: Math.max(0, group.headCount + sign * effect.delta),
    });
  }

  function checkedMedicine(input: MedicineInput, partial: boolean): MedicinePatch {
    const patch: MedicinePatch = {};
    if (!partial || input.productName !== undefined) {
      const name = text(input.productName, 'Product name');
      if (!name) throw appError('BAD_INPUT', 'Product name is required');
      patch.productName = name;
    }
    for (const key of ['batchNumber', 'quantity', 'supplier'] as const)
      if (!partial || input[key] !== undefined) patch[key] = text(input[key], 'That field');
    if (!partial || input.note !== undefined) patch.note = text(input.note, 'Note', MAX_NOTE);
    for (const [key, label] of [
      ['expiryDate', 'Expiry date'],
      ['purchasedOn', 'Purchase date'],
      ['finishedOn', 'Date finished'],
    ] as const)
      if (!partial || input[key] !== undefined) patch[key] = optionalDate(input[key], label);
    for (const [key, label] of [
      ['meatWithdrawalDays', 'Meat withdrawal'],
      ['milkWithdrawalDays', 'Milk withdrawal'],
    ] as const)
      if (!partial || input[key] !== undefined)
        patch[key] =
          input[key] == null
            ? null
            : wholeNumber(input[key], `${label} days`, 0, MAX_WITHDRAWAL_DAYS);
    return patch;
  }

  async function requireMedicine(userId: string, id: string) {
    const item = await register.getMedicine(id);
    if (!item || !(await farmService.getFarm(userId, item.farmId)))
      throw appError('NOT_FOUND', `Medicine ${id} not found`);
    await farmService.requireFarm(userId, item.farmId, 'work');
    return item;
  }

  return {
    medicineStatus: (item: MedicineItem) => medicineStatus(item, today()),

    async record(user: Recorder, input: RegisterEventInput) {
      const group = await farmService.requireGroup(user.id, input.groupId, 'work');
      const event = await register.addEvent({
        farmId: group.farmId,
        groupId: group.id,
        ...checked(group, input),
        recordedBy: user.email,
        recordedAt: now().toISOString(),
      });
      await applyHeadCount(event, 1);
      return event;
    },

    /** Voided events stay in the list, struck through, and their head count change is undone. */
    async voidEvent(user: Recorder, id: string, rawReason: string) {
      const event = await register.getEvent(id);
      if (!event || !(await farmService.getGroup(user.id, event.groupId)))
        throw appError('NOT_FOUND', `Register entry ${id} not found`);
      await farmService.requireGroup(user.id, event.groupId, 'work');
      if (event.voidedAt) throw appError('BAD_INPUT', 'This entry has already been voided');
      const reason = text(rawReason, 'Reason', 500);
      if (!reason) throw appError('BAD_INPUT', 'Give a reason for voiding it');
      const voided = await register.voidEvent(id, now().toISOString(), reason);
      if (!voided) throw appError('NOT_FOUND', `Register entry ${id} not found`);
      // A voided head count can't be undone (the earlier total isn't known): fix it by hand.
      await applyHeadCount(voided, -1);
      return voided;
    },

    /** Every event on the farm, newest first, including voided ones. */
    async events(userId: string, farmId: string) {
      await farmService.requireFarm(userId, farmId);
      return register.listEvents(farmId);
    },

    /** For a group already checked. */
    async eventsForGroup(groupId: string, farmId: string) {
      return (await register.listEvents(farmId)).filter((e) => e.groupId === groupId);
    },

    eventsForFarm: (farmId: string) => register.listEvents(farmId),

    async weights(group: LivestockGroup) {
      return weightPoints(
        (await register.listEvents(group.farmId)).filter((e) => e.groupId === group.id),
      );
    },

    /** The holding register with running head counts, archived groups included. */
    async holdingRegister(userId: string, farmId: string) {
      await farmService.requireFarm(userId, farmId);
      const groups = await farms.listGroups(farmId);
      const counts = new Map(groups.map((g) => [g.id, g.headCount]));
      return registerRows(await register.listEvents(farmId), counts);
    },

    async medicines(userId: string, farmId: string) {
      await farmService.requireFarm(userId, farmId);
      return register.listMedicines(farmId);
    },

    medicinesForFarm: (farmId: string) => register.listMedicines(farmId),

    async addMedicine(userId: string, farmId: string, input: MedicineInput) {
      await farmService.requireFarm(userId, farmId, 'work');
      const fields = checkedMedicine(input, false) as Required<MedicinePatch>;
      return register.addMedicine({
        farmId,
        productName: fields.productName,
        batchNumber: fields.batchNumber,
        quantity: fields.quantity,
        expiryDate: fields.expiryDate,
        supplier: fields.supplier,
        purchasedOn: fields.purchasedOn,
        meatWithdrawalDays: fields.meatWithdrawalDays,
        milkWithdrawalDays: fields.milkWithdrawalDays,
        note: fields.note,
      });
    },

    async updateMedicine(userId: string, id: string, input: MedicineInput) {
      await requireMedicine(userId, id);
      const updated = await register.updateMedicine(id, checkedMedicine(input, true));
      if (!updated) throw appError('NOT_FOUND', `Medicine ${id} not found`);
      return updated;
    },

    async deleteMedicine(userId: string, id: string) {
      await requireMedicine(userId, id);
      return register.deleteMedicine(id);
    },
  };
}

export type RegisterService = ReturnType<typeof createRegisterService>;

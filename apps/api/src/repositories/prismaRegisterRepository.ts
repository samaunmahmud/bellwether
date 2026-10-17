import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import type { MedicineItem, RegisterEvent, RegisterEventKind } from '../domain/register';
import {
  byExpiry,
  type MedicinePatch,
  type NewMedicine,
  type NewRegisterEvent,
  type RegisterRepository,
} from './registerRepository';

// Dates are stored as Postgres DATE columns, which Prisma reads as midnight UTC.
const toDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromDb = (date: Date) => date.toISOString().slice(0, 10);
const toDbOrNull = (iso: string | null) => (iso === null ? null : toDb(iso));
const fromDbOrNull = (date: Date | null) => (date === null ? null : fromDb(date));

const eventSelect = {
  id: true,
  farmId: true,
  groupId: true,
  kind: true,
  date: true,
  count: true,
  bornDead: true,
  value: true,
  otherParty: true,
  reference: true,
  cause: true,
  note: true,
  recordedBy: true,
  recordedAt: true,
  voidedAt: true,
  voidReason: true,
} as const;

interface EventRow {
  id: string;
  farmId: string;
  groupId: string;
  kind: RegisterEventKind;
  date: Date;
  count: number | null;
  bornDead: number | null;
  value: number | null;
  otherParty: string | null;
  reference: string | null;
  cause: string | null;
  note: string | null;
  recordedBy: string;
  recordedAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
}

const toEvent = (row: EventRow): RegisterEvent => ({
  ...row,
  date: fromDb(row.date),
  recordedAt: row.recordedAt.toISOString(),
  voidedAt: row.voidedAt?.toISOString() ?? null,
});

const medicineSelect = {
  id: true,
  farmId: true,
  productName: true,
  batchNumber: true,
  quantity: true,
  expiryDate: true,
  supplier: true,
  purchasedOn: true,
  meatWithdrawalDays: true,
  milkWithdrawalDays: true,
  note: true,
  finishedOn: true,
} as const;

interface MedicineRow extends Omit<MedicineItem, 'expiryDate' | 'purchasedOn' | 'finishedOn'> {
  expiryDate: Date | null;
  purchasedOn: Date | null;
  finishedOn: Date | null;
}

const toMedicine = (row: MedicineRow): MedicineItem => ({
  ...row,
  expiryDate: fromDbOrNull(row.expiryDate),
  purchasedOn: fromDbOrNull(row.purchasedOn),
  finishedOn: fromDbOrNull(row.finishedOn),
});

const DATE_KEYS = ['expiryDate', 'purchasedOn', 'finishedOn'] as const;

function medicineData(patch: MedicinePatch) {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    data[key] = (DATE_KEYS as readonly string[]).includes(key)
      ? toDbOrNull(value as string | null)
      : value;
  }
  return data;
}

export class PrismaRegisterRepository implements RegisterRepository {
  constructor(private db: PrismaClient) {}

  async addEvent(input: NewRegisterEvent) {
    const row = await this.db.registerEvent.create({
      data: { ...input, date: toDb(input.date), recordedAt: new Date(input.recordedAt) },
      select: eventSelect,
    });
    return toEvent(row);
  }

  async getEvent(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.registerEvent.findUnique({ where: { id }, select: eventSelect });
    return row ? toEvent(row) : null;
  }

  async listEvents(farmId: string) {
    if (!isUuid(farmId)) return [];
    const rows = await this.db.registerEvent.findMany({
      where: { farmId },
      orderBy: [{ date: 'desc' }, { seq: 'desc' }],
      select: eventSelect,
    });
    return rows.map(toEvent);
  }

  async voidEvent(id: string, voidedAt: string, reason: string) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.registerEvent.updateMany({
      where: { id },
      data: { voidedAt: new Date(voidedAt), voidReason: reason },
    });
    return count ? this.getEvent(id) : null;
  }

  async addMedicine(input: NewMedicine) {
    const row = await this.db.medicineItem.create({
      data: {
        ...input,
        expiryDate: toDbOrNull(input.expiryDate),
        purchasedOn: toDbOrNull(input.purchasedOn),
      },
      select: medicineSelect,
    });
    return toMedicine(row);
  }

  async getMedicine(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.medicineItem.findUnique({ where: { id }, select: medicineSelect });
    return row ? toMedicine(row) : null;
  }

  async listMedicines(farmId: string) {
    if (!isUuid(farmId)) return [];
    const rows = await this.db.medicineItem.findMany({ where: { farmId }, select: medicineSelect });
    return rows.map(toMedicine).sort(byExpiry);
  }

  async updateMedicine(id: string, patch: MedicinePatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.medicineItem.updateMany({
      where: { id },
      data: medicineData(patch),
    });
    return count ? this.getMedicine(id) : null;
  }

  async deleteMedicine(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.medicineItem.deleteMany({ where: { id } });
    return count > 0;
  }
}

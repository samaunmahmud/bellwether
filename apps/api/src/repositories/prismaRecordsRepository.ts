import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import type { Observation, Treatment } from '../domain/records';
import type { NewObservation, NewTreatment, RecordsRepository } from './recordsRepository';

// Dates are stored as Postgres DATE columns, which Prisma reads as midnight UTC.
const toDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromDb = (date: Date) => date.toISOString().slice(0, 10);

const treatmentSelect = {
  id: true,
  farmId: true,
  groupId: true,
  date: true,
  productName: true,
  batchNumber: true,
  quantityUsed: true,
  animalsTreated: true,
  administeredBy: true,
  reason: true,
  meatWithdrawalDays: true,
  milkWithdrawalDays: true,
} as const;

const observationSelect = {
  id: true,
  farmId: true,
  groupId: true,
  date: true,
  type: true,
  note: true,
} as const;

const withIsoDate = <T extends { date: Date }>(row: T) => ({ ...row, date: fromDb(row.date) });

/** Postgres-backed RecordsRepository. Shares its contract tests with the in-memory fake. */
export class PrismaRecordsRepository implements RecordsRepository {
  constructor(private db: PrismaClient) {}

  async addTreatment(input: NewTreatment): Promise<Treatment> {
    const row = await this.db.treatment.create({
      data: { ...input, date: toDb(input.date) },
      select: treatmentSelect,
    });
    return withIsoDate(row);
  }

  async listTreatments(groupId: string): Promise<Treatment[]> {
    if (!isUuid(groupId)) return [];
    const rows = await this.db.treatment.findMany({
      where: { groupId },
      orderBy: [{ date: 'desc' }, { seq: 'desc' }],
      select: treatmentSelect,
    });
    return rows.map(withIsoDate);
  }

  async listFarmTreatments(farmId: string, from: string, to: string): Promise<Treatment[]> {
    if (!isUuid(farmId)) return [];
    const rows = await this.db.treatment.findMany({
      where: { farmId, date: { gte: toDb(from), lte: toDb(to) } },
      orderBy: [{ date: 'asc' }, { seq: 'asc' }],
      select: treatmentSelect,
    });
    return rows.map(withIsoDate);
  }

  async addObservation(input: NewObservation): Promise<Observation> {
    const row = await this.db.observation.create({
      data: { ...input, date: toDb(input.date) },
      select: observationSelect,
    });
    return withIsoDate(row);
  }

  async listObservations(groupId: string): Promise<Observation[]> {
    if (!isUuid(groupId)) return [];
    const rows = await this.db.observation.findMany({
      where: { groupId },
      orderBy: [{ date: 'desc' }, { seq: 'desc' }],
      select: observationSelect,
    });
    return rows.map(withIsoDate);
  }
}

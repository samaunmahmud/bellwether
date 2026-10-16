import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import type {
  FieldChange,
  Observation,
  RecordRevision,
  RecordType,
  RevisionAction,
  Treatment,
} from '../domain/records';
import type {
  NewObservation,
  NewRevision,
  NewTreatment,
  ObservationPatch,
  RecordsRepository,
  TreatmentPatch,
} from './recordsRepository';

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
  voidedAt: true,
  voidReason: true,
} as const;

const observationSelect = {
  id: true,
  farmId: true,
  groupId: true,
  date: true,
  type: true,
  note: true,
  voidedAt: true,
  voidReason: true,
} as const;

const fromRow = <T extends { date: Date; voidedAt: Date | null }>(row: T) => ({
  ...row,
  date: fromDb(row.date),
  voidedAt: row.voidedAt?.toISOString() ?? null,
});

/** Converts a domain patch (ISO strings) to Prisma data (Dates), leaving out undefined keys. */
function patchToDb(patch: TreatmentPatch | ObservationPatch) {
  const { date, voidedAt, ...rest } = patch;
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  if (date !== undefined) data.date = toDb(date);
  if (voidedAt !== undefined) data.voidedAt = voidedAt === null ? null : new Date(voidedAt);
  return data;
}

const revisionData = (revision: NewRevision) => ({
  farmId: revision.farmId,
  recordType: revision.recordType,
  recordId: revision.recordId,
  action: revision.action,
  reason: revision.reason,
  editedById: revision.editedById,
  editedBy: revision.editedBy,
  editedAt: new Date(revision.at),
  changes: revision.changes as unknown as object,
});

/** Postgres-backed RecordsRepository. Shares its contract tests with the in-memory fake. */
export class PrismaRecordsRepository implements RecordsRepository {
  constructor(private db: PrismaClient) {}

  async addTreatment(input: NewTreatment): Promise<Treatment> {
    const row = await this.db.treatment.create({
      data: { ...input, date: toDb(input.date) },
      select: treatmentSelect,
    });
    return fromRow(row);
  }

  async getTreatment(id: string): Promise<Treatment | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.treatment.findUnique({ where: { id }, select: treatmentSelect });
    return row ? fromRow(row) : null;
  }

  async listTreatments(groupId: string): Promise<Treatment[]> {
    if (!isUuid(groupId)) return [];
    const rows = await this.db.treatment.findMany({
      where: { groupId },
      orderBy: [{ date: 'desc' }, { seq: 'desc' }],
      select: treatmentSelect,
    });
    return rows.map(fromRow);
  }

  async listFarmTreatments(farmId: string, from: string, to: string): Promise<Treatment[]> {
    if (!isUuid(farmId)) return [];
    const rows = await this.db.treatment.findMany({
      where: { farmId, date: { gte: toDb(from), lte: toDb(to) } },
      orderBy: [{ date: 'asc' }, { seq: 'asc' }],
      select: treatmentSelect,
    });
    return rows.map(fromRow);
  }

  async reviseTreatment(id: string, patch: TreatmentPatch, revision: NewRevision) {
    if (!isUuid(id)) return null;
    return this.db.$transaction(async (tx) => {
      const { count } = await tx.treatment.updateMany({ where: { id }, data: patchToDb(patch) });
      if (!count) return null;
      await tx.recordRevision.create({ data: revisionData(revision) });
      const row = await tx.treatment.findUniqueOrThrow({ where: { id }, select: treatmentSelect });
      return fromRow(row);
    });
  }

  async addObservation(input: NewObservation): Promise<Observation> {
    const row = await this.db.observation.create({
      data: { ...input, date: toDb(input.date) },
      select: observationSelect,
    });
    return fromRow(row);
  }

  async getObservation(id: string): Promise<Observation | null> {
    if (!isUuid(id)) return null;
    const row = await this.db.observation.findUnique({ where: { id }, select: observationSelect });
    return row ? fromRow(row) : null;
  }

  async listObservations(groupId: string): Promise<Observation[]> {
    if (!isUuid(groupId)) return [];
    const rows = await this.db.observation.findMany({
      where: { groupId },
      orderBy: [{ date: 'desc' }, { seq: 'desc' }],
      select: observationSelect,
    });
    return rows.map(fromRow);
  }

  async reviseObservation(id: string, patch: ObservationPatch, revision: NewRevision) {
    if (!isUuid(id)) return null;
    return this.db.$transaction(async (tx) => {
      const { count } = await tx.observation.updateMany({ where: { id }, data: patchToDb(patch) });
      if (!count) return null;
      await tx.recordRevision.create({ data: revisionData(revision) });
      const row = await tx.observation.findUniqueOrThrow({
        where: { id },
        select: observationSelect,
      });
      return fromRow(row);
    });
  }

  async listRevisions(recordId: string): Promise<RecordRevision[]> {
    if (!isUuid(recordId)) return [];
    const rows = await this.db.recordRevision.findMany({
      where: { recordId },
      orderBy: [{ editedAt: 'desc' }, { seq: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      farmId: row.farmId,
      recordId: row.recordId,
      recordType: row.recordType as RecordType,
      action: row.action as RevisionAction,
      reason: row.reason,
      editedById: row.editedById,
      editedBy: row.editedBy,
      at: row.editedAt.toISOString(),
      changes: row.changes as unknown as FieldChange[],
    }));
  }
}

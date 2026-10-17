import type { AnimalCategory } from '@bellwether/risk-engine';
import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import { Prisma } from '../generated/prisma/client';
import {
  definedOnly,
  type Animal,
  type AnimalPatch,
  type AnimalRepository,
  type LogEntry,
  type LogEntryPatch,
  type NewAnimal,
  type NewLogEntry,
} from './animalRepository';

// Dates are stored as Postgres DATE columns, which Prisma reads as midnight UTC.
const toDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromDb = (date: Date) => date.toISOString().slice(0, 10);
const toDbOrNull = (iso: string | null | undefined) =>
  iso === undefined ? undefined : iso === null ? null : toDb(iso);

const petSelect = {
  id: true,
  ownerId: true,
  name: true,
  species: true,
  category: true,
  postcode: true,
  highExposureHabitat: true,
  remindersEnabled: true,
  dateOfBirth: true,
  breed: true,
  sex: true,
  microchip: true,
} as const;

type NewAnimalData = Omit<NewAnimal, 'dateOfBirth'> & { dateOfBirth: Date | null };

const logSelect = {
  id: true,
  petId: true,
  date: true,
  type: true,
  note: true,
  nextDueDate: true,
  weightKg: true,
} as const;

type PetRow = Omit<Animal, 'category' | 'dateOfBirth'> & {
  category: string;
  dateOfBirth: Date | null;
};
type LogRow = {
  id: string;
  petId: string;
  date: Date;
  type: string;
  note: string | null;
  nextDueDate: Date | null;
  weightKg: number | null;
};

const toAnimal = (row: PetRow): Animal => ({
  ...row,
  category: row.category as AnimalCategory,
  dateOfBirth: row.dateOfBirth ? fromDb(row.dateOfBirth) : null,
});

const petData = <T extends { dateOfBirth?: string | null }>(input: T) =>
  definedOnly({ ...input, dateOfBirth: toDbOrNull(input.dateOfBirth) });

const toLog = ({ petId, date, nextDueDate, ...rest }: LogRow): LogEntry => ({
  ...rest,
  animalId: petId,
  date: fromDb(date),
  nextDueDate: nextDueDate ? fromDb(nextDueDate) : null,
});

/** Postgres-backed AnimalRepository. Shares its contract tests with the in-memory fake. */
export class PrismaAnimalRepository implements AnimalRepository {
  constructor(private db: PrismaClient) {}

  async listAnimalsWithReminders() {
    const rows = await this.db.pet.findMany({
      where: { remindersEnabled: true },
      orderBy: { seq: 'asc' },
      select: petSelect,
    });
    return rows.map(toAnimal);
  }

  async claimReminderEmail(ownerId: string, date: string) {
    if (!isUuid(ownerId)) return false;
    try {
      await this.db.petReminderEmail.create({ data: { userId: ownerId, date: toDb(date) } });
      return true;
    } catch (err) {
      // P2002: already claimed (possibly by another server instance)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
      throw err;
    }
  }

  async listAnimals(ownerId: string) {
    if (!isUuid(ownerId)) return [];
    const rows = await this.db.pet.findMany({
      where: { ownerId },
      orderBy: { seq: 'asc' },
      select: petSelect,
    });
    return rows.map(toAnimal);
  }

  async getAnimal(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.pet.findUnique({ where: { id }, select: petSelect });
    return row ? toAnimal(row) : null;
  }

  async createAnimal(input: NewAnimal) {
    return toAnimal(
      await this.db.pet.create({ data: petData(input) as NewAnimalData, select: petSelect }),
    );
  }

  async updateAnimal(id: string, patch: AnimalPatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.pet.updateMany({ where: { id }, data: petData(patch) });
    return count ? this.getAnimal(id) : null;
  }

  async deleteAnimal(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.pet.deleteMany({ where: { id } });
    return count > 0;
  }

  async listLogs(animalId: string) {
    if (!isUuid(animalId)) return [];
    const rows = await this.db.petLogEntry.findMany({
      where: { petId: animalId },
      orderBy: [{ date: 'desc' }, { seq: 'desc' }],
      select: logSelect,
    });
    return rows.map(toLog);
  }

  async getLog(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.petLogEntry.findUnique({ where: { id }, select: logSelect });
    return row ? toLog(row) : null;
  }

  async addLog(input: NewLogEntry) {
    const row = await this.db.petLogEntry.create({
      data: {
        petId: input.animalId,
        date: toDb(input.date),
        type: input.type,
        note: input.note ?? null,
        nextDueDate: toDbOrNull(input.nextDueDate ?? null),
        weightKg: input.weightKg ?? null,
      },
      select: logSelect,
    });
    return toLog(row);
  }

  async updateLog(id: string, patch: LogEntryPatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.petLogEntry.updateMany({
      where: { id },
      data: definedOnly({
        type: patch.type,
        note: patch.note,
        date: patch.date === undefined ? undefined : toDb(patch.date),
        nextDueDate: toDbOrNull(patch.nextDueDate),
        weightKg: patch.weightKg,
      }),
    });
    return count ? this.getLog(id) : null;
  }

  async deleteLog(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.petLogEntry.deleteMany({ where: { id } });
    return count > 0;
  }
}

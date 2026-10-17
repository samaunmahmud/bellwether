import { randomUUID } from 'node:crypto';
import type { AnimalCategory } from '@bellwether/risk-engine';

export interface LogEntry {
  id: string;
  animalId: string;
  date: string;
  type: string;
  note: string | null;
  nextDueDate: string | null;
  /** v3: weight on the day, kg */
  weightKg: number | null;
}

export interface Animal {
  id: string;
  /** The user who added it. Pets are scoped per user (A15). */
  ownerId: string;
  name: string;
  species: string;
  category: AnimalCategory;
  /** Where the pet lives, for its own forecast (FR-2.6). Normalised. */
  postcode: string | null;
  /** Walks in long grass or woodland: raises tick risk. */
  highExposureHabitat: boolean;
}

export type NewAnimal = Omit<Animal, 'id'>;
export type AnimalPatch = Partial<Pick<Animal, 'name' | 'postcode' | 'highExposureHabitat'>>;

export interface NewLogEntry {
  animalId: string;
  date: string;
  type: string;
  note?: string | null;
  nextDueDate?: string | null;
  weightKg?: number | null;
}

export type LogEntryPatch = Partial<
  Pick<LogEntry, 'date' | 'type' | 'note' | 'nextDueDate' | 'weightKg'>
>;

/** Storage for pets and their logs (FR-2.6). Unknown or malformed ids mean "not found". */
export interface AnimalRepository {
  /** Oldest first */
  listAnimals(ownerId: string): Promise<Animal[]>;
  getAnimal(id: string): Promise<Animal | null>;
  createAnimal(input: NewAnimal): Promise<Animal>;
  updateAnimal(id: string, patch: AnimalPatch): Promise<Animal | null>;
  /** Deletes the animal and its log. */
  deleteAnimal(id: string): Promise<boolean>;
  /** Newest first; on the same day, the most recently added first. */
  listLogs(animalId: string): Promise<LogEntry[]>;
  getLog(id: string): Promise<LogEntry | null>;
  addLog(input: NewLogEntry): Promise<LogEntry>;
  updateLog(id: string, patch: LogEntryPatch): Promise<LogEntry | null>;
  deleteLog(id: string): Promise<boolean>;
}

/** Drops keys whose value is undefined, so a patch only touches what was given. */
export function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const withoutSeq = ({ seq: _seq, ...log }: LogEntry & { seq: number }): LogEntry => log;

export class InMemoryAnimalRepository implements AnimalRepository {
  private animals = new Map<string, Animal>();
  private logs = new Map<string, LogEntry & { seq: number }>();
  private seq = 0;

  constructor(private newId: () => string = randomUUID) {}

  async listAnimals(ownerId: string) {
    return [...this.animals.values()].filter((a) => a.ownerId === ownerId);
  }

  async getAnimal(id: string) {
    return this.animals.get(id) ?? null;
  }

  async createAnimal(input: NewAnimal) {
    const animal = { id: this.newId(), ...input };
    this.animals.set(animal.id, animal);
    return animal;
  }

  async updateAnimal(id: string, patch: AnimalPatch) {
    const animal = this.animals.get(id);
    if (!animal) return null;
    const updated = { ...animal, ...definedOnly(patch) };
    this.animals.set(id, updated);
    return updated;
  }

  async deleteAnimal(id: string) {
    for (const log of this.logs.values()) {
      if (log.animalId === id) this.logs.delete(log.id);
    }
    return this.animals.delete(id);
  }

  async listLogs(animalId: string) {
    return [...this.logs.values()]
      .filter((l) => l.animalId === animalId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq)
      .map(withoutSeq);
  }

  async getLog(id: string) {
    const stored = this.logs.get(id);
    return stored ? withoutSeq(stored) : null;
  }

  async addLog(input: NewLogEntry) {
    const entry: LogEntry = {
      id: this.newId(),
      animalId: input.animalId,
      date: input.date,
      type: input.type,
      note: input.note ?? null,
      nextDueDate: input.nextDueDate ?? null,
      weightKg: input.weightKg ?? null,
    };
    this.logs.set(entry.id, { ...entry, seq: ++this.seq });
    return entry;
  }

  async updateLog(id: string, patch: LogEntryPatch) {
    const stored = this.logs.get(id);
    if (!stored) return null;
    this.logs.set(id, { ...stored, ...definedOnly(patch) });
    return this.getLog(id);
  }

  async deleteLog(id: string) {
    return this.logs.delete(id);
  }
}

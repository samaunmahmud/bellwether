import { randomUUID } from 'node:crypto';
import type { AnimalCategory } from '@bellwether/risk-engine';

export interface LogEntry {
  id: string;
  animalId: string;
  date: string;
  type: string;
  note: string | null;
  nextDueDate: string | null;
}

export interface Animal {
  id: string;
  name: string;
  species: string;
  category: AnimalCategory;
}

export interface NewLogEntry {
  animalId: string;
  date: string;
  type: string;
  note?: string | null;
  nextDueDate?: string | null;
}

/**
 * Storage for animals and their logs. The MVP uses the in-memory version below.
 * TODO(phase 2): add a PrismaAnimalRepository backed by prisma/schema.prisma and switch to it in index.ts.
 */
export interface AnimalRepository {
  listAnimals(): Promise<Animal[]>;
  getAnimal(id: string): Promise<Animal | null>;
  createAnimal(input: Omit<Animal, 'id'>): Promise<Animal>;
  listLogs(animalId: string): Promise<LogEntry[]>;
  addLog(input: NewLogEntry): Promise<LogEntry>;
  deleteLog(id: string): Promise<boolean>;
}

export class InMemoryAnimalRepository implements AnimalRepository {
  private animals = new Map<string, Animal>();
  private logs = new Map<string, LogEntry>();

  constructor(private newId: () => string = randomUUID) {}

  async listAnimals() {
    return [...this.animals.values()];
  }

  async getAnimal(id: string) {
    return this.animals.get(id) ?? null;
  }

  async createAnimal(input: Omit<Animal, 'id'>) {
    const animal = { id: this.newId(), ...input };
    this.animals.set(animal.id, animal);
    return animal;
  }

  async listLogs(animalId: string) {
    return [...this.logs.values()]
      .filter((l) => l.animalId === animalId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async addLog(input: NewLogEntry) {
    const entry: LogEntry = {
      id: this.newId(),
      animalId: input.animalId,
      date: input.date,
      type: input.type,
      note: input.note ?? null,
      nextDueDate: input.nextDueDate ?? null,
    };
    this.logs.set(entry.id, entry);
    return entry;
  }

  async deleteLog(id: string) {
    return this.logs.delete(id);
  }
}

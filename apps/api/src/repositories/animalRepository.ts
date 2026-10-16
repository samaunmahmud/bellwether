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
  /** The user who added it. Pets are scoped per user until FR-2.6 (A15). */
  ownerId: string;
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
 * Storage for pet animals and their logs, kept in memory until FR-2.6 / FR-6.6 replace them (A7).
 */
export interface AnimalRepository {
  listAnimals(ownerId: string): Promise<Animal[]>;
  getAnimal(id: string): Promise<Animal | null>;
  createAnimal(input: Omit<Animal, 'id'>): Promise<Animal>;
  listLogs(animalId: string): Promise<LogEntry[]>;
  getLog(id: string): Promise<LogEntry | null>;
  addLog(input: NewLogEntry): Promise<LogEntry>;
  deleteLog(id: string): Promise<boolean>;
}

export class InMemoryAnimalRepository implements AnimalRepository {
  private animals = new Map<string, Animal>();
  private logs = new Map<string, LogEntry>();

  constructor(private newId: () => string = randomUUID) {}

  async listAnimals(ownerId: string) {
    return [...this.animals.values()].filter((a) => a.ownerId === ownerId);
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

  async getLog(id: string) {
    return this.logs.get(id) ?? null;
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

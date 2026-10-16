import { randomUUID } from 'node:crypto';
import type { Observation, Treatment } from '../domain/records';

export type NewTreatment = Omit<Treatment, 'id'>;
export type NewObservation = Omit<Observation, 'id'>;

/**
 * Storage for treatment records and checks (FR-6). There is deliberately no delete:
 * records are never hard-deleted (FR-6.5).
 */
export interface RecordsRepository {
  addTreatment(input: NewTreatment): Promise<Treatment>;
  /** Newest first; on the same day, the most recently recorded first. */
  listTreatments(groupId: string): Promise<Treatment[]>;
  /** A farm's treatments from `from` to `to` inclusive, oldest first (for audits, FR-6.4). */
  listFarmTreatments(farmId: string, from: string, to: string): Promise<Treatment[]>;

  addObservation(input: NewObservation): Promise<Observation>;
  /** Newest first; on the same day, the most recently recorded first. */
  listObservations(groupId: string): Promise<Observation[]>;
}

type Stored<T> = T & { seq: number };

const newestFirst = <T extends { date: string; seq: number }>(a: T, b: T) =>
  b.date.localeCompare(a.date) || b.seq - a.seq;

const strip = <T>({ seq: _seq, ...record }: Stored<T>): T => record as T;

export class InMemoryRecordsRepository implements RecordsRepository {
  private treatments: Array<Stored<Treatment>> = [];
  private observations: Array<Stored<Observation>> = [];
  private seq = 0;

  constructor(private newId: () => string = randomUUID) {}

  async addTreatment(input: NewTreatment) {
    const treatment = { ...input, id: this.newId() };
    this.treatments.push({ ...treatment, seq: ++this.seq });
    return treatment;
  }

  async listTreatments(groupId: string) {
    return this.treatments
      .filter((t) => t.groupId === groupId)
      .sort(newestFirst)
      .map((t) => strip<Treatment>(t));
  }

  async listFarmTreatments(farmId: string, from: string, to: string) {
    return this.treatments
      .filter((t) => t.farmId === farmId && t.date >= from && t.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq)
      .map((t) => strip<Treatment>(t));
  }

  async addObservation(input: NewObservation) {
    const observation = { ...input, id: this.newId() };
    this.observations.push({ ...observation, seq: ++this.seq });
    return observation;
  }

  async listObservations(groupId: string) {
    return this.observations
      .filter((o) => o.groupId === groupId)
      .sort(newestFirst)
      .map((o) => strip<Observation>(o));
  }
}

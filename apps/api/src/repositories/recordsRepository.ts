import { randomUUID } from 'node:crypto';
import type { Observation, RecordRevision, Treatment } from '../domain/records';

type VoidFields = 'voidedAt' | 'voidReason';
export type NewTreatment = Omit<Treatment, 'id' | VoidFields>;
export type NewObservation = Omit<Observation, 'id' | VoidFields>;
export type TreatmentPatch = Partial<Omit<Treatment, 'id' | 'farmId' | 'groupId'>>;
export type ObservationPatch = Partial<Omit<Observation, 'id' | 'farmId' | 'groupId'>>;
export type NewRevision = Omit<RecordRevision, 'id'>;

/**
 * Storage for treatment records and checks (FR-6). There is deliberately no delete:
 * records are never hard-deleted. Corrections and voids are saved together with a
 * revision describing them (FR-6.5).
 */
export interface RecordsRepository {
  addTreatment(input: NewTreatment): Promise<Treatment>;
  getTreatment(id: string): Promise<Treatment | null>;
  /** Newest first; on the same day, the most recently recorded first. Includes voided ones. */
  listTreatments(groupId: string): Promise<Treatment[]>;
  /** A farm's treatments from `from` to `to` inclusive, oldest first (for audits, FR-6.4). */
  listFarmTreatments(farmId: string, from: string, to: string): Promise<Treatment[]>;
  /** Applies the patch and stores the revision in one go. Null if there's no such treatment. */
  reviseTreatment(
    id: string,
    patch: TreatmentPatch,
    revision: NewRevision,
  ): Promise<Treatment | null>;

  addObservation(input: NewObservation): Promise<Observation>;
  getObservation(id: string): Promise<Observation | null>;
  /** Newest first; on the same day, the most recently recorded first. */
  listObservations(groupId: string): Promise<Observation[]>;
  reviseObservation(
    id: string,
    patch: ObservationPatch,
    revision: NewRevision,
  ): Promise<Observation | null>;

  /** A record's revisions, newest first. */
  listRevisions(recordId: string): Promise<RecordRevision[]>;
}

type Stored<T> = T & { seq: number };

const newestFirst = <T extends { date: string; seq: number }>(a: T, b: T) =>
  b.date.localeCompare(a.date) || b.seq - a.seq;

const strip = <T>({ seq: _seq, ...record }: Stored<T>): T => record as T;

const notVoided = { voidedAt: null, voidReason: null };

export class InMemoryRecordsRepository implements RecordsRepository {
  private treatments: Array<Stored<Treatment>> = [];
  private observations: Array<Stored<Observation>> = [];
  private revisions: Array<Stored<RecordRevision>> = [];
  private seq = 0;

  constructor(private newId: () => string = randomUUID) {}

  async addTreatment(input: NewTreatment) {
    const treatment: Treatment = { ...input, ...notVoided, id: this.newId() };
    this.treatments.push({ ...treatment, seq: ++this.seq });
    return treatment;
  }

  async getTreatment(id: string) {
    const found = this.treatments.find((t) => t.id === id);
    return found ? strip<Treatment>(found) : null;
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

  async reviseTreatment(id: string, patch: TreatmentPatch, revision: NewRevision) {
    const index = this.treatments.findIndex((t) => t.id === id);
    if (index < 0) return null;
    const updated = { ...this.treatments[index]!, ...defined(patch) };
    this.treatments[index] = updated;
    this.addRevision(revision);
    return strip<Treatment>(updated);
  }

  async addObservation(input: NewObservation) {
    const observation: Observation = { ...input, ...notVoided, id: this.newId() };
    this.observations.push({ ...observation, seq: ++this.seq });
    return observation;
  }

  async getObservation(id: string) {
    const found = this.observations.find((o) => o.id === id);
    return found ? strip<Observation>(found) : null;
  }

  async listObservations(groupId: string) {
    return this.observations
      .filter((o) => o.groupId === groupId)
      .sort(newestFirst)
      .map((o) => strip<Observation>(o));
  }

  async reviseObservation(id: string, patch: ObservationPatch, revision: NewRevision) {
    const index = this.observations.findIndex((o) => o.id === id);
    if (index < 0) return null;
    const updated = { ...this.observations[index]!, ...defined(patch) };
    this.observations[index] = updated;
    this.addRevision(revision);
    return strip<Observation>(updated);
  }

  async listRevisions(recordId: string) {
    return this.revisions
      .filter((r) => r.recordId === recordId)
      .sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq)
      .map((r) => strip<RecordRevision>(r));
  }

  private addRevision(revision: NewRevision) {
    this.revisions.push({ ...revision, id: this.newId(), seq: ++this.seq });
  }
}

/** Drops undefined keys, so a patch only touches what was given. */
function defined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

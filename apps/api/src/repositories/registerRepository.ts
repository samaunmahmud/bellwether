import { randomUUID } from 'node:crypto';
import type { MedicineItem, RegisterEvent } from '../domain/register';

export type NewRegisterEvent = Omit<RegisterEvent, 'id' | 'voidedAt' | 'voidReason'>;
export type NewMedicine = Omit<MedicineItem, 'id' | 'finishedOn'>;
export type MedicinePatch = Partial<Omit<MedicineItem, 'id' | 'farmId'>>;

/**
 * Storage for the holding register and the medicine cabinet (v3). Register events are never
 * deleted, only voided, like treatment records (FR-6.5).
 */
export interface RegisterRepository {
  addEvent(input: NewRegisterEvent): Promise<RegisterEvent>;
  getEvent(id: string): Promise<RegisterEvent | null>;
  /** Newest first; on the same day, the most recently recorded first. Includes voided ones. */
  listEvents(farmId: string): Promise<RegisterEvent[]>;
  /** Null if there's no such event. */
  voidEvent(id: string, voidedAt: string, reason: string): Promise<RegisterEvent | null>;

  addMedicine(input: NewMedicine): Promise<MedicineItem>;
  getMedicine(id: string): Promise<MedicineItem | null>;
  /** Soonest expiry first, then by name; items with no expiry last. */
  listMedicines(farmId: string): Promise<MedicineItem[]>;
  updateMedicine(id: string, patch: MedicinePatch): Promise<MedicineItem | null>;
  deleteMedicine(id: string): Promise<boolean>;
}

type Stored<T> = T & { seq: number };

const strip = <T>({ seq: _seq, ...rest }: Stored<T>): T => rest as T;

export const byExpiry = (a: MedicineItem, b: MedicineItem) =>
  (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') ||
  a.productName.localeCompare(b.productName);

export class InMemoryRegisterRepository implements RegisterRepository {
  private events: Array<Stored<RegisterEvent>> = [];
  private medicines: MedicineItem[] = [];
  private seq = 0;

  constructor(private newId: () => string = randomUUID) {}

  async addEvent(input: NewRegisterEvent) {
    const event: RegisterEvent = { ...input, id: this.newId(), voidedAt: null, voidReason: null };
    this.events.push({ ...event, seq: ++this.seq });
    return event;
  }

  async getEvent(id: string) {
    const found = this.events.find((e) => e.id === id);
    return found ? strip<RegisterEvent>(found) : null;
  }

  async listEvents(farmId: string) {
    return this.events
      .filter((e) => e.farmId === farmId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq)
      .map((e) => strip<RegisterEvent>(e));
  }

  async voidEvent(id: string, voidedAt: string, reason: string) {
    const found = this.events.find((e) => e.id === id);
    if (!found) return null;
    Object.assign(found, { voidedAt, voidReason: reason });
    return strip<RegisterEvent>(found);
  }

  async addMedicine(input: NewMedicine) {
    const item: MedicineItem = { ...input, id: this.newId(), finishedOn: null };
    this.medicines.push(item);
    return { ...item };
  }

  async getMedicine(id: string) {
    const found = this.medicines.find((m) => m.id === id);
    return found ? { ...found } : null;
  }

  async listMedicines(farmId: string) {
    return this.medicines
      .filter((m) => m.farmId === farmId)
      .sort(byExpiry)
      .map((m) => ({ ...m }));
  }

  async updateMedicine(id: string, patch: MedicinePatch) {
    const found = this.medicines.find((m) => m.id === id);
    if (!found) return null;
    for (const [key, value] of Object.entries(patch))
      if (value !== undefined) Object.assign(found, { [key]: value });
    return { ...found };
  }

  async deleteMedicine(id: string) {
    const before = this.medicines.length;
    this.medicines = this.medicines.filter((m) => m.id !== id);
    return this.medicines.length < before;
  }
}

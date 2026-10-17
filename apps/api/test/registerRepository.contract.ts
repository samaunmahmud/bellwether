import { beforeEach, describe, expect, it } from 'vitest';
import type {
  NewMedicine,
  NewRegisterEvent,
  RegisterRepository,
} from '../src/repositories/registerRepository';

export interface RegisterFixture {
  repo: RegisterRepository;
  /** Creates a livestock group (real rows in Postgres) and returns its ids. */
  newGroup(): Promise<{ farmId: string; groupId: string }>;
}

export function eventInput(
  ids: { farmId: string; groupId: string },
  overrides: Partial<NewRegisterEvent> = {},
): NewRegisterEvent {
  return {
    ...ids,
    kind: 'DEATH',
    date: '2026-06-01',
    count: 1,
    bornDead: null,
    value: null,
    otherParty: null,
    reference: 'FS-123',
    cause: 'Found dead',
    note: null,
    recordedBy: 'ann@example.com',
    recordedAt: '2026-06-01T09:00:00.000Z',
    ...overrides,
  };
}

export function medicineInput(farmId: string, overrides: Partial<NewMedicine> = {}): NewMedicine {
  return {
    farmId,
    productName: 'Product from label',
    batchNumber: 'B1',
    quantity: '500 ml',
    expiryDate: '2027-01-31',
    supplier: 'Local merchant',
    purchasedOn: '2026-05-01',
    meatWithdrawalDays: 28,
    milkWithdrawalDays: null,
    note: null,
    ...overrides,
  };
}

/** Behaviour every RegisterRepository must share (in-memory fake and Postgres). */
export function registerRepositoryContract(makeFixture: () => Promise<RegisterFixture>) {
  let repo: RegisterRepository;
  let newGroup: RegisterFixture['newGroup'];

  beforeEach(async () => {
    ({ repo, newGroup } = await makeFixture());
  });

  describe('register events', () => {
    it('stores every field, with nulls kept', async () => {
      const ids = await newGroup();
      const saved = await repo.addEvent(
        eventInput(ids, { kind: 'WEIGHING', count: 20, value: 32.5, cause: null }),
      );
      expect(saved).toEqual({
        id: expect.any(String),
        ...eventInput(ids, { kind: 'WEIGHING', count: 20, value: 32.5, cause: null }),
        voidedAt: null,
        voidReason: null,
      });
      expect(await repo.getEvent(saved.id)).toEqual(saved);
    });

    it("lists a farm's events newest first, later-recorded first on the same day", async () => {
      const ids = await newGroup();
      const a = await repo.addEvent(eventInput(ids, { date: '2026-06-01' }));
      const b = await repo.addEvent(eventInput(ids, { date: '2026-06-05' }));
      const c = await repo.addEvent(eventInput(ids, { date: '2026-06-05' }));
      const other = await newGroup();
      await repo.addEvent(eventInput(other));
      expect((await repo.listEvents(ids.farmId)).map((e) => e.id)).toEqual([c.id, b.id, a.id]);
    });

    it('voids an event, keeping it in the list', async () => {
      const ids = await newGroup();
      const event = await repo.addEvent(eventInput(ids));
      const voided = await repo.voidEvent(event.id, '2026-06-02T10:00:00.000Z', 'Wrong group');
      expect(voided).toMatchObject({
        voidedAt: '2026-06-02T10:00:00.000Z',
        voidReason: 'Wrong group',
      });
      expect(await repo.listEvents(ids.farmId)).toHaveLength(1);
    });

    it('returns null for unknown ids', async () => {
      expect(await repo.getEvent('00000000-0000-4000-8000-000000000000')).toBeNull();
      expect(await repo.getEvent('not-an-id')).toBeNull();
      expect(await repo.voidEvent('not-an-id', '2026-06-02T10:00:00.000Z', 'x')).toBeNull();
    });
  });

  describe('medicine cabinet', () => {
    it('stores, lists by expiry with no-expiry last, updates and deletes', async () => {
      const { farmId } = await newGroup();
      const later = await repo.addMedicine(medicineInput(farmId, { expiryDate: '2027-06-01' }));
      const none = await repo.addMedicine(
        medicineInput(farmId, { productName: 'A', expiryDate: null }),
      );
      const sooner = await repo.addMedicine(medicineInput(farmId, { expiryDate: '2026-09-01' }));
      expect(sooner).toEqual({
        id: expect.any(String),
        ...medicineInput(farmId, { expiryDate: '2026-09-01' }),
        finishedOn: null,
      });
      expect((await repo.listMedicines(farmId)).map((m) => m.id)).toEqual([
        sooner.id,
        later.id,
        none.id,
      ]);

      const updated = await repo.updateMedicine(later.id, {
        finishedOn: '2026-07-01',
        quantity: undefined,
      });
      expect(updated).toMatchObject({ finishedOn: '2026-07-01', quantity: '500 ml' });

      expect(await repo.deleteMedicine(none.id)).toBe(true);
      expect(await repo.deleteMedicine(none.id)).toBe(false);
      expect(await repo.getMedicine(none.id)).toBeNull();
      expect(await repo.updateMedicine('not-an-id', { note: 'x' })).toBeNull();
    });
  });
}

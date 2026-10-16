import { beforeEach, describe, expect, it } from 'vitest';
import type { Treatment } from '../src/domain/records';
import type { RecordsRepository } from '../src/repositories/recordsRepository';

export interface RecordsFixture {
  repo: RecordsRepository;
  /** Creates a livestock group (real rows in Postgres) and returns its ids. */
  newGroup(): Promise<{ farmId: string; groupId: string }>;
}

export function treatmentInput(
  ids: { farmId: string; groupId: string },
  overrides: Partial<Omit<Treatment, 'id'>> = {},
): Omit<Treatment, 'id'> {
  return {
    ...ids,
    date: '2026-06-01',
    productName: 'Product typed by farmer',
    batchNumber: 'B123',
    quantityUsed: '250 ml',
    animalsTreated: 40,
    administeredBy: 'Ann',
    reason: 'Lameness',
    meatWithdrawalDays: 28,
    milkWithdrawalDays: null,
    ...overrides,
  };
}

/** Behaviour every RecordsRepository must share (in-memory fake and Postgres). */
export function recordsRepositoryContract(makeFixture: () => Promise<RecordsFixture>) {
  let repo: RecordsRepository;
  let newGroup: RecordsFixture['newGroup'];

  beforeEach(async () => {
    ({ repo, newGroup } = await makeFixture());
  });

  describe('treatments (FR-6.1)', () => {
    it('stores every field, with dates as ISO strings and nulls kept', async () => {
      const ids = await newGroup();
      const saved = await repo.addTreatment(treatmentInput(ids, { batchNumber: null }));
      expect(saved).toEqual({
        id: expect.any(String),
        ...treatmentInput(ids, { batchNumber: null }),
      });
      expect(await repo.listTreatments(ids.groupId)).toEqual([saved]);
    });

    it('lists a group’s treatments newest first, later-recorded first on the same day', async () => {
      const ids = await newGroup();
      const a = await repo.addTreatment(treatmentInput(ids, { date: '2026-06-01' }));
      const b = await repo.addTreatment(treatmentInput(ids, { date: '2026-06-05' }));
      const c = await repo.addTreatment(treatmentInput(ids, { date: '2026-06-05' }));
      expect((await repo.listTreatments(ids.groupId)).map((t) => t.id)).toEqual([c.id, b.id, a.id]);
    });

    it('lists a farm’s treatments in a date range, oldest first, inclusive (FR-6.4)', async () => {
      const g1 = await newGroup();
      const before = await repo.addTreatment(treatmentInput(g1, { date: '2026-05-31' }));
      const first = await repo.addTreatment(treatmentInput(g1, { date: '2026-06-01' }));
      const last = await repo.addTreatment(treatmentInput(g1, { date: '2026-06-30' }));
      await repo.addTreatment(treatmentInput(g1, { date: '2026-07-01' }));
      const otherFarm = await newGroup();
      await repo.addTreatment(treatmentInput(otherFarm, { date: '2026-06-10' }));

      const inJune = await repo.listFarmTreatments(g1.farmId, '2026-06-01', '2026-06-30');
      expect(inJune.map((t) => t.id)).toEqual([first.id, last.id]);
      expect(inJune.map((t) => t.id)).not.toContain(before.id);
    });
  });

  describe('observations (FR-6.6)', () => {
    it('stores and lists a group’s checks newest first', async () => {
      const ids = await newGroup();
      const older = await repo.addObservation({
        ...ids,
        date: '2026-06-01',
        type: 'Flock inspected',
        note: '2 struck ewes found',
      });
      const newer = await repo.addObservation({
        ...ids,
        date: '2026-06-03',
        type: 'Water checked',
        note: null,
      });
      expect(older).toEqual({
        id: expect.any(String),
        ...ids,
        date: '2026-06-01',
        type: 'Flock inspected',
        note: '2 struck ewes found',
      });
      expect((await repo.listObservations(ids.groupId)).map((o) => o.id)).toEqual([
        newer.id,
        older.id,
      ]);
    });

    it('keeps groups’ records apart', async () => {
      const a = await newGroup();
      const b = await newGroup();
      await repo.addObservation({ ...a, date: '2026-06-01', type: 'Check', note: null });
      expect(await repo.listObservations(b.groupId)).toEqual([]);
      expect(await repo.listTreatments(b.groupId)).toEqual([]);
    });
  });
}

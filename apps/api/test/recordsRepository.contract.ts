import { beforeEach, describe, expect, it } from 'vitest';
import type {
  NewTreatment,
  RecordsRepository,
  NewRevision,
} from '../src/repositories/recordsRepository';

export interface RecordsFixture {
  repo: RecordsRepository;
  /** Creates a livestock group (real rows in Postgres) and returns its ids. */
  newGroup(): Promise<{ farmId: string; groupId: string }>;
}

export function treatmentInput(
  ids: { farmId: string; groupId: string },
  overrides: Partial<NewTreatment> = {},
): NewTreatment {
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
        voidedAt: null,
        voidReason: null,
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
        voidedAt: null,
        voidReason: null,
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

  describe('corrections with history (FR-6.5)', () => {
    const revision = (
      ids: { farmId: string },
      recordId: string,
      overrides: Partial<NewRevision> = {},
    ): NewRevision => ({
      farmId: ids.farmId,
      recordId,
      recordType: 'TREATMENT',
      action: 'EDITED',
      reason: 'Typo in batch number',
      editedById: null,
      editedBy: 'ann@example.com',
      at: '2026-06-02T10:00:00.000Z',
      changes: [{ field: 'Batch number', from: 'B123', to: 'B124' }],
      ...overrides,
    });

    it('gets a treatment by id', async () => {
      const ids = await newGroup();
      const saved = await repo.addTreatment(treatmentInput(ids));
      expect(await repo.getTreatment(saved.id)).toEqual(saved);
    });

    it('changes a treatment and keeps a revision of what changed', async () => {
      const ids = await newGroup();
      const saved = await repo.addTreatment(treatmentInput(ids));
      const updated = await repo.reviseTreatment(
        saved.id,
        { batchNumber: 'B124' },
        revision(ids, saved.id),
      );
      expect(updated).toEqual({ ...saved, batchNumber: 'B124' });
      expect(await repo.getTreatment(saved.id)).toEqual(updated);
      expect(await repo.listRevisions(saved.id)).toEqual([
        { id: expect.any(String), ...revision(ids, saved.id) },
      ]);
    });

    it('voids a treatment without deleting it', async () => {
      const ids = await newGroup();
      const saved = await repo.addTreatment(treatmentInput(ids));
      const voided = await repo.reviseTreatment(
        saved.id,
        { voidedAt: '2026-06-03T08:00:00.000Z', voidReason: 'Recorded twice' },
        revision(ids, saved.id, { action: 'VOIDED', reason: 'Recorded twice', changes: [] }),
      );
      expect(voided).toMatchObject({
        voidedAt: '2026-06-03T08:00:00.000Z',
        voidReason: 'Recorded twice',
      });
      expect(await repo.listTreatments(ids.groupId)).toEqual([voided]);
      expect(await repo.listFarmTreatments(ids.farmId, '2026-06-01', '2026-06-01')).toEqual([
        voided,
      ]);
    });

    it('lists revisions newest first', async () => {
      const ids = await newGroup();
      const saved = await repo.addTreatment(treatmentInput(ids));
      await repo.reviseTreatment(saved.id, { batchNumber: 'B1' }, revision(ids, saved.id));
      await repo.reviseTreatment(
        saved.id,
        { batchNumber: 'B2' },
        revision(ids, saved.id, { at: '2026-06-04T10:00:00.000Z', reason: 'Second fix' }),
      );
      expect((await repo.listRevisions(saved.id)).map((r) => r.reason)).toEqual([
        'Second fix',
        'Typo in batch number',
      ]);
    });

    it('changes and voids an observation', async () => {
      const ids = await newGroup();
      const saved = await repo.addObservation({
        ...ids,
        date: '2026-06-01',
        type: 'Flock inspected',
        note: null,
      });
      expect(await repo.getObservation(saved.id)).toEqual(saved);
      const updated = await repo.reviseObservation(
        saved.id,
        { note: '2 struck ewes', voidedAt: null },
        revision(ids, saved.id, { recordType: 'OBSERVATION' }),
      );
      expect(updated).toEqual({ ...saved, note: '2 struck ewes' });
      expect(await repo.listRevisions(saved.id)).toHaveLength(1);
    });

    it('returns null for a record that does not exist', async () => {
      const ids = await newGroup();
      const missing = '00000000-0000-4000-8000-000000000000';
      expect(await repo.getTreatment(missing)).toBeNull();
      expect(await repo.getObservation(missing)).toBeNull();
      expect(
        await repo.reviseTreatment(missing, { batchNumber: 'x' }, revision(ids, missing)),
      ).toBeNull();
      expect(await repo.listRevisions(missing)).toEqual([]);
    });
  });

  describe('ids that are not UUIDs', () => {
    it('are treated as not found', async () => {
      expect(await repo.getTreatment('x')).toBeNull();
      expect(await repo.getObservation('x')).toBeNull();
      expect(await repo.listRevisions('x')).toEqual([]);
      expect(await repo.listTreatments('x')).toEqual([]);
      expect(await repo.listObservations('x')).toEqual([]);
      expect(await repo.listFarmTreatments('x', '2026-01-01', '2026-12-31')).toEqual([]);
    });
  });
}

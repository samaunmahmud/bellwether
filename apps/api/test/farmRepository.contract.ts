import { beforeEach, describe, expect, it } from 'vitest';
import type { Field, LivestockGroup } from '../src/domain/farm';
import type { FarmRepository, NewField, NewGroup } from '../src/repositories/farmRepository';

export function sheepGroup(farmId: string, overrides: Partial<NewGroup> = {}): NewGroup {
  return {
    farmId,
    name: 'North flock',
    species: 'SHEEP',
    livestockClass: 'EWES',
    headCount: 120,
    currentFieldId: null,
    housed: false,
    lastShearingDate: null,
    lambingStart: null,
    lambingEnd: null,
    lambsAtGrassThisSpring: false,
    cattleType: null,
    calvingStart: null,
    calvingEnd: null,
    ...overrides,
  };
}

/**
 * Behaviour every FarmRepository must share. Runs against the in-memory fake
 * and, when a test database is available, against Postgres via Prisma.
 */
export interface FarmRepositoryFixture {
  repo: FarmRepository;
  /** Creates a user that can own farms (a real row in Postgres). */
  newUserId(): Promise<string>;
}

export function farmRepositoryContract(makeFixture: () => Promise<FarmRepositoryFixture>) {
  let repo: FarmRepository;
  let owner: string;
  let newUserId: () => Promise<string>;

  beforeEach(async () => {
    ({ repo, newUserId } = await makeFixture());
    owner = await newUserId();
  });

  /** A new-field input copied from an existing field, without its id. */
  const copyOf = ({ id: _id, ...field }: Field, overrides: Partial<NewField>): NewField => ({
    ...field,
    ...overrides,
  });

  async function farmWithField() {
    const farm = await repo.createFarm({ name: 'Hill Farm', postcode: 'UB8 3PH' }, owner);
    const field = await repo.createField({
      farmId: farm.id,
      name: 'Top field',
      postcode: null,
      latitude: 54.12345,
      longitude: -2.54321,
    });
    return { farm, field };
  }

  describe('farms', () => {
    it('creates, gets and lists farms', async () => {
      const farm = await repo.createFarm({ name: 'Hill Farm', postcode: 'UB8 3PH' }, owner);
      expect(farm).toEqual({ id: expect.any(String), name: 'Hill Farm', postcode: 'UB8 3PH' });
      expect(await repo.getFarm(farm.id)).toEqual(farm);
    });

    it('makes the creator the farm owner (FR-8.1, A13)', async () => {
      const farm = await repo.createFarm({ name: 'Hill Farm', postcode: 'UB8 3PH' }, owner);
      expect(await repo.getRole(farm.id, owner)).toBe('OWNER');
      expect(await repo.getRole(farm.id, await newUserId())).toBeNull();
    });

    it('lists every farm id and a farm’s members, for the briefing job (FR-4.5)', async () => {
      const a = await repo.createFarm({ name: 'A Farm', postcode: 'UB8 3PH' }, owner);
      const b = await repo.createFarm({ name: 'B Farm', postcode: 'UB8 3PH' }, await newUserId());
      expect((await repo.listFarmIds()).sort()).toEqual([a.id, b.id].sort());
      expect(await repo.listMembers(a.id)).toEqual([{ userId: owner, role: 'OWNER' }]);
    });

    it('lists only the farms a user belongs to, sorted by name (FR-8.4)', async () => {
      const someoneElse = await newUserId();
      const b = await repo.createFarm({ name: 'B Farm', postcode: 'UB8 3PH' }, owner);
      const a = await repo.createFarm({ name: 'A Farm', postcode: 'UB8 3PH' }, owner);
      await repo.createFarm({ name: 'Their farm', postcode: 'UB8 3PH' }, someoneElse);
      expect(await repo.listFarmsForUser(owner)).toEqual([a, b]);
      expect(await repo.listFarmsForUser(await newUserId())).toEqual([]);
    });

    it('returns null for an unknown farm', async () => {
      expect(await repo.getFarm('00000000-0000-0000-0000-000000000000')).toBeNull();
    });
  });

  describe('fields', () => {
    it('stores a pin and a missing postcode exactly', async () => {
      const { field } = await farmWithField();
      expect(await repo.getField(field.id)).toEqual(field);
      expect(field).toMatchObject({ postcode: null, latitude: 54.12345, longitude: -2.54321 });
    });

    it('lists only the given farm’s fields, sorted by name', async () => {
      const { farm, field } = await farmWithField();
      const other = await repo.createFarm({ name: 'Other', postcode: 'SW1A 1AA' }, owner);
      await repo.createField(copyOf(field, { farmId: other.id, name: 'Elsewhere' }));
      const bottom = await repo.createField({
        farmId: farm.id,
        name: 'Bottom meadow',
        postcode: 'SW1A 1AA',
        latitude: null,
        longitude: null,
      });
      expect((await repo.listFields(farm.id)).map((f) => f.id)).toEqual([bottom.id, field.id]);
    });

    it('returns null for an unknown field', async () => {
      expect(await repo.getField('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('starts active, and updates and archives a field', async () => {
      const { field } = await farmWithField();
      expect(field.archivedOn).toBeNull();
      const updated = await repo.updateField(field.id, {
        name: 'Top meadow',
        postcode: 'SW1A 1AA',
        latitude: null,
        longitude: null,
        archivedOn: '2026-06-10',
      });
      expect(updated).toEqual({
        ...field,
        name: 'Top meadow',
        postcode: 'SW1A 1AA',
        latitude: null,
        longitude: null,
        archivedOn: '2026-06-10',
      });
      expect(await repo.getField(field.id)).toEqual(updated);
      expect(
        await repo.updateField('00000000-0000-0000-0000-000000000000', { name: 'x' }),
      ).toBeNull();
    });
  });

  describe('livestock groups', () => {
    it('round-trips every attribute, including dates as ISO strings', async () => {
      const { farm } = await farmWithField();
      const group = await repo.createGroup(
        sheepGroup(farm.id, {
          lastShearingDate: '2026-05-20',
          lambingStart: '2026-03-01',
          lambingEnd: '2026-04-15',
          lambsAtGrassThisSpring: true,
        }),
        null,
      );
      expect(await repo.getGroup(group.id)).toEqual(group);
      expect(group).toMatchObject({
        lastShearingDate: '2026-05-20',
        lambingStart: '2026-03-01',
        lambingEnd: '2026-04-15',
      });

      const cattle = await repo.createGroup(
        sheepGroup(farm.id, {
          name: 'Dairy herd',
          species: 'CATTLE',
          livestockClass: 'DAIRY_COWS',
          cattleType: 'DAIRY',
          calvingStart: '2026-08-01',
          calvingEnd: '2026-10-31',
        }),
        null,
      );
      expect(await repo.getGroup(cattle.id)).toEqual(cattle);
    });

    it('records the initial placement as a movement when given a field and date', async () => {
      const { farm, field } = await farmWithField();
      const group = await repo.createGroup(
        sheepGroup(farm.id, { currentFieldId: field.id }),
        '2026-06-01',
      );
      expect(group.currentFieldId).toBe(field.id);
      expect(await repo.listMovements(group.id)).toEqual([
        {
          id: expect.any(String),
          farmId: farm.id,
          groupId: group.id,
          fromFieldId: null,
          toFieldId: field.id,
          movedOn: '2026-06-01',
        },
      ]);
    });

    it('records no movement for a group created without a field', async () => {
      const { farm } = await farmWithField();
      const group = await repo.createGroup(sheepGroup(farm.id), null);
      expect(await repo.listMovements(group.id)).toEqual([]);
    });

    it('lists only the given farm’s groups, sorted by name', async () => {
      const { farm } = await farmWithField();
      const other = await repo.createFarm({ name: 'Other', postcode: 'SW1A 1AA' }, owner);
      await repo.createGroup(sheepGroup(other.id), null);
      const b = await repo.createGroup(sheepGroup(farm.id, { name: 'B flock' }), null);
      const a = await repo.createGroup(sheepGroup(farm.id, { name: 'A flock' }), null);
      expect((await repo.listGroups(farm.id)).map((g) => g.id)).toEqual([a.id, b.id]);
    });

    it('updates only the patched attributes', async () => {
      const { farm } = await farmWithField();
      const group = await repo.createGroup(sheepGroup(farm.id), null);
      const updated = await repo.updateGroup(group.id, {
        headCount: 118,
        housed: true,
        lastShearingDate: '2026-06-10',
      });
      const expected: LivestockGroup = {
        ...group,
        headCount: 118,
        housed: true,
        lastShearingDate: '2026-06-10',
      };
      expect(updated).toEqual(expected);
      expect(await repo.getGroup(group.id)).toEqual(expected);
    });

    it('returns null for an unknown group', async () => {
      expect(await repo.getGroup('00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('archives a group with a date and reason, and restores it', async () => {
      const { farm } = await farmWithField();
      const group = await repo.createGroup(sheepGroup(farm.id), null);
      expect(group).toMatchObject({ archivedOn: null, archiveReason: null });
      const archived = await repo.updateGroup(group.id, {
        archivedOn: '2026-06-10',
        archiveReason: 'Sold at market',
      });
      expect(archived).toEqual({
        ...group,
        archivedOn: '2026-06-10',
        archiveReason: 'Sold at market',
      });
      expect((await repo.listGroups(farm.id)).map((g) => g.archivedOn)).toEqual(['2026-06-10']);
      const restored = await repo.updateGroup(group.id, { archivedOn: null, archiveReason: null });
      expect(restored).toEqual(group);
    });
  });

  describe('farm details', () => {
    it('updates a farm', async () => {
      const { farm } = await farmWithField();
      const updated = await repo.updateFarm(farm.id, { name: 'High Farm', postcode: 'SW1A 1AA' });
      expect(updated).toEqual({ ...farm, name: 'High Farm', postcode: 'SW1A 1AA' });
      expect(await repo.getFarm(farm.id)).toEqual(updated);
      expect(
        await repo.updateFarm('00000000-0000-0000-0000-000000000000', { name: 'x' }),
      ).toBeNull();
    });

    it('deletes a farm with everything on it', async () => {
      const { farm, field } = await farmWithField();
      const group = await repo.createGroup(
        sheepGroup(farm.id, { currentFieldId: field.id }),
        '2026-06-01',
      );
      expect(await repo.deleteFarm(farm.id)).toBe(true);
      expect(await repo.getFarm(farm.id)).toBeNull();
      expect(await repo.getField(field.id)).toBeNull();
      expect(await repo.getGroup(group.id)).toBeNull();
      expect(await repo.listMovements(group.id)).toEqual([]);
      expect(await repo.getRole(farm.id, owner)).toBeNull();
      expect(await repo.listFarmsForUser(owner)).toEqual([]);
      expect(await repo.deleteFarm(farm.id)).toBe(false);
    });
  });

  describe('movements (FR-2.4)', () => {
    it('records a move and updates the current field when asked', async () => {
      const { farm, field } = await farmWithField();
      const other = await repo.createField(copyOf(field, { name: 'Lower field' }));
      const group = await repo.createGroup(
        sheepGroup(farm.id, { currentFieldId: field.id }),
        '2026-06-01',
      );

      await repo.recordMovement(
        {
          farmId: farm.id,
          groupId: group.id,
          fromFieldId: field.id,
          toFieldId: other.id,
          movedOn: '2026-06-05',
        },
        true,
      );
      expect((await repo.getGroup(group.id))!.currentFieldId).toBe(other.id);
    });

    it('keeps the current field when told not to (backdated move)', async () => {
      const { farm, field } = await farmWithField();
      const other = await repo.createField(copyOf(field, { name: 'Lower field' }));
      const group = await repo.createGroup(
        sheepGroup(farm.id, { currentFieldId: field.id }),
        '2026-06-01',
      );

      await repo.recordMovement(
        {
          farmId: farm.id,
          groupId: group.id,
          fromFieldId: null,
          toFieldId: other.id,
          movedOn: '2026-05-01',
        },
        false,
      );
      expect((await repo.getGroup(group.id))!.currentFieldId).toBe(field.id);
    });

    it('lists history newest first, and the later-recorded move first on the same day', async () => {
      const { farm, field } = await farmWithField();
      const lower = await repo.createField(copyOf(field, { name: 'Lower field' }));
      const group = await repo.createGroup(
        sheepGroup(farm.id, { currentFieldId: field.id }),
        '2026-06-01',
      );
      const move = (from: string, to: string, movedOn: string) =>
        repo.recordMovement(
          { farmId: farm.id, groupId: group.id, fromFieldId: from, toFieldId: to, movedOn },
          true,
        );

      const first = await move(field.id, lower.id, '2026-06-03');
      const second = await move(lower.id, field.id, '2026-06-03');
      const older = await move(field.id, lower.id, '2026-06-02');

      const history = await repo.listMovements(group.id);
      expect(history.map((m) => m.id)).toEqual([
        second.id,
        first.id,
        older.id,
        history[3]!.id, // initial placement
      ]);
      expect(history[3]!.movedOn).toBe('2026-06-01');
    });
  });

  describe('ids that are not UUIDs (as sent by clients)', () => {
    it('are treated as not found when updating or deleting', async () => {
      expect(await repo.updateFarm('x', { name: 'y' })).toBeNull();
      expect(await repo.deleteFarm('x')).toBe(false);
      expect(await repo.updateField('x', { name: 'y' })).toBeNull();
    });

    it('are treated as not found, never as errors', async () => {
      expect(await repo.getFarm('x')).toBeNull();
      expect(await repo.getField('x')).toBeNull();
      expect(await repo.getGroup('x')).toBeNull();
      expect(await repo.getRole('x', 'y')).toBeNull();
      expect(await repo.getRole('x', owner)).toBeNull();
      expect(await repo.listFields('x')).toEqual([]);
      expect(await repo.listGroups('x')).toEqual([]);
      expect(await repo.listMovements('x')).toEqual([]);
      expect(await repo.listMembers('x')).toEqual([]);
      expect(await repo.listFarmsForUser('x')).toEqual([]);
    });
  });
}

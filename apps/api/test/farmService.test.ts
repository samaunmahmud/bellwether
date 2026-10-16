import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache/cache';
import type { Location } from '../src/clients/postcodesClient';
import { silentLogger } from '../src/logger';
import { InMemoryFarmRepository } from '../src/repositories/farmRepository';
import { createFarmService, type GroupInput } from '../src/services/farmService';
import { createLocationService } from '../src/services/locationService';
import { fakePostcodes, UXBRIDGE } from './fakes';

const WESTMINSTER: Location = {
  postcode: 'SW1A 1AA',
  latitude: 51.501,
  longitude: -0.1416,
  region: 'London',
};

const ANN = 'user-ann';
const BOB = 'user-bob';

// 2026-06-01 10:00 in London (BST)
const NOW = new Date('2026-06-01T09:00:00Z');

const code = (c: string) => ({ extensions: { code: c } });

function setup() {
  const repo = new InMemoryFarmRepository();
  const locations = createLocationService({
    postcodes: fakePostcodes([UXBRIDGE, WESTMINSTER]).client,
    cache: new MemoryCache(),
    logger: silentLogger,
  });
  const service = createFarmService({ repo, locations, now: () => NOW });
  return { repo, service };
}

describe('farmService', () => {
  let s: ReturnType<typeof setup>;
  let farmId: string;

  beforeEach(async () => {
    s = setup();
    farmId = (await s.service.createFarm(ANN, { name: 'Hill Farm', postcode: 'ub83ph' })).id;
  });

  const sheep = (overrides: Partial<GroupInput> = {}): GroupInput => ({
    farmId,
    name: 'North flock',
    species: 'SHEEP',
    livestockClass: 'EWES',
    headCount: 120,
    ...overrides,
  });

  const cattle = (overrides: Partial<GroupInput> = {}): GroupInput => ({
    farmId,
    name: 'Dairy herd',
    species: 'CATTLE',
    livestockClass: 'DAIRY_COWS',
    headCount: 80,
    ...overrides,
  });

  describe('farm scoping (FR-8.4)', () => {
    it('lists and gets only farms the user belongs to', async () => {
      expect((await s.service.listFarms(ANN)).map((f) => f.id)).toEqual([farmId]);
      expect(await s.service.listFarms(BOB)).toEqual([]);
      expect(await s.service.getFarm(ANN, farmId)).not.toBeNull();
      expect(await s.service.getFarm(BOB, farmId)).toBeNull();
    });

    it('treats another user’s farm, field and group as not found', async () => {
      const field = await s.service.createField(ANN, { farmId, name: 'Top' });
      const group = await s.service.createGroup(ANN, sheep({ currentFieldId: field.id }));
      const bobFarm = await s.service.createFarm(BOB, { name: 'Bob’s', postcode: 'SW1A 1AA' });
      const bobGroup = await s.service.createGroup(BOB, sheep({ farmId: bobFarm.id }));

      const attempts = [
        s.service.createField(BOB, { farmId, name: 'Sneaky' }),
        s.service.createGroup(BOB, sheep()),
        s.service.updateGroup(BOB, group.id, { headCount: 1 }),
        s.service.moveGroup(BOB, { groupId: group.id, toFieldId: field.id, movedOn: '2026-06-01' }),
        // Bob's own group into Ann's field
        s.service.moveGroup(BOB, {
          groupId: bobGroup.id,
          toFieldId: field.id,
          movedOn: '2026-06-01',
        }),
      ];
      for (const attempt of attempts) {
        await expect(attempt).rejects.toMatchObject(code('NOT_FOUND'));
      }
      expect(await s.service.getGroup(BOB, group.id)).toBeNull();
      expect(await s.service.getGroup(ANN, group.id)).toMatchObject({ headCount: 120 });
    });
  });

  describe('createFarm (FR-2.1)', () => {
    it('trims the name and normalises the postcode', async () => {
      const farm = await s.service.createFarm(ANN, { name: '  Hill Farm ', postcode: 'ub8 3ph' });
      expect(farm).toMatchObject({ name: 'Hill Farm', postcode: 'UB8 3PH' });
    });

    it('rejects a blank name', async () => {
      await expect(
        s.service.createFarm(ANN, { name: '  ', postcode: 'UB8 3PH' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('accepts a 100-character name and rejects 101', async () => {
      await expect(
        s.service.createFarm(ANN, { name: 'a'.repeat(100), postcode: 'UB8 3PH' }),
      ).resolves.toBeDefined();
      await expect(
        s.service.createFarm(ANN, { name: 'a'.repeat(101), postcode: 'UB8 3PH' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('rejects an invalid or unknown postcode', async () => {
      await expect(
        s.service.createFarm(ANN, { name: 'X', postcode: 'nope' }),
      ).rejects.toMatchObject(code('INVALID_POSTCODE'));
      await expect(
        s.service.createFarm(ANN, { name: 'X', postcode: 'ZZ1 1ZZ' }),
      ).rejects.toMatchObject(code('POSTCODE_NOT_FOUND'));
    });
  });

  describe('createField (FR-2.2)', () => {
    it('stores a pin, a postcode, or neither', async () => {
      const pin = await s.service.createField(ANN, {
        farmId,
        name: 'Hill',
        latitude: 54.1,
        longitude: -2.5,
      });
      const pc = await s.service.createField(ANN, { farmId, name: 'Meadow', postcode: 'sw1a1aa' });
      const none = await s.service.createField(ANN, { farmId, name: 'Paddock' });
      expect(pin).toMatchObject({ latitude: 54.1, longitude: -2.5, postcode: null });
      expect(pc).toMatchObject({ postcode: 'SW1A 1AA', latitude: null, longitude: null });
      expect(none).toMatchObject({ postcode: null, latitude: null, longitude: null });
    });

    it('rejects a pin with only one coordinate', async () => {
      await expect(
        s.service.createField(ANN, { farmId, name: 'Hill', latitude: 54.1 }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        s.service.createField(ANN, { farmId, name: 'Hill', longitude: -2.5 }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it.each([
      [49.8, -2, true],
      [49.79, -2, false],
      [60.9, -2, true],
      [60.91, -2, false],
      [54, -8.7, true],
      [54, -8.71, false],
      [54, 1.8, true],
      [54, 1.81, false],
      [-2.5, 54.1, false], // swapped lat/long
    ])('pin at (%s, %s) inside the UK: %s', async (latitude, longitude, ok) => {
      const result = s.service.createField(ANN, { farmId, name: 'Hill', latitude, longitude });
      if (ok) await expect(result).resolves.toBeDefined();
      else await expect(result).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('rejects an unknown farm and an unknown field postcode', async () => {
      await expect(
        s.service.createField(ANN, { farmId: 'nope', name: 'Hill' }),
      ).rejects.toMatchObject(code('NOT_FOUND'));
      await expect(
        s.service.createField(ANN, { farmId, name: 'Hill', postcode: 'ZZ1 1ZZ' }),
      ).rejects.toMatchObject(code('POSTCODE_NOT_FOUND'));
    });

    it('rejects a blank field name', async () => {
      await expect(s.service.createField(ANN, { farmId, name: ' ' })).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
    });
  });

  describe('createGroup (FR-2.3, FR-2.5)', () => {
    it('creates a sheep group with species attributes and sensible defaults', async () => {
      const group = await s.service.createGroup(
        ANN,
        sheep({
          lastShearingDate: '2026-05-20',
          lambingStart: '2026-03-01',
          lambingEnd: '2026-04-15',
          lambsAtGrassThisSpring: true,
        }),
      );
      expect(group).toMatchObject({
        farmId,
        species: 'SHEEP',
        livestockClass: 'EWES',
        headCount: 120,
        housed: false,
        currentFieldId: null,
        lastShearingDate: '2026-05-20',
        lambingStart: '2026-03-01',
        lambingEnd: '2026-04-15',
        lambsAtGrassThisSpring: true,
        cattleType: null,
      });
    });

    it('derives dairy or beef from the cattle class', async () => {
      expect((await s.service.createGroup(ANN, cattle())).cattleType).toBe('DAIRY');
      expect(
        (await s.service.createGroup(ANN, cattle({ livestockClass: 'BEEF_CATTLE' }))).cattleType,
      ).toBe('BEEF');
      expect(
        (await s.service.createGroup(ANN, cattle({ livestockClass: 'CALVES' }))).cattleType,
      ).toBeNull();
      expect(
        (await s.service.createGroup(ANN, cattle({ livestockClass: 'CALVES', cattleType: 'BEEF' })))
          .cattleType,
      ).toBe('BEEF');
    });

    it('rejects a cattle type that contradicts the class', async () => {
      await expect(
        s.service.createGroup(ANN, cattle({ cattleType: 'BEEF' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('rejects a class from the other species', async () => {
      await expect(
        s.service.createGroup(ANN, sheep({ livestockClass: 'CALVES' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        s.service.createGroup(ANN, cattle({ livestockClass: 'EWES' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('rejects sheep attributes on cattle and cattle attributes on sheep', async () => {
      for (const input of [
        cattle({ lastShearingDate: '2026-05-01' }),
        cattle({ lambingStart: '2026-03-01', lambingEnd: '2026-04-01' }),
        cattle({ lambsAtGrassThisSpring: true }),
        sheep({ cattleType: 'BEEF' }),
        sheep({ calvingStart: '2026-03-01', calvingEnd: '2026-04-01' }),
      ]) {
        await expect(s.service.createGroup(ANN, input)).rejects.toMatchObject(code('BAD_INPUT'));
      }
    });

    it('accepts a head count of 1 and rejects 0 or a fraction', async () => {
      await expect(s.service.createGroup(ANN, sheep({ headCount: 1 }))).resolves.toBeDefined();
      for (const headCount of [0, 1.5]) {
        await expect(s.service.createGroup(ANN, sheep({ headCount }))).rejects.toMatchObject(
          code('BAD_INPUT'),
        );
      }
    });

    it('needs both lambing dates, with the end on or after the start', async () => {
      await expect(
        s.service.createGroup(ANN, sheep({ lambingStart: '2026-03-01', lambingEnd: '2026-03-01' })),
      ).resolves.toBeDefined();
      await expect(
        s.service.createGroup(ANN, sheep({ lambingStart: '2026-03-02', lambingEnd: '2026-03-01' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        s.service.createGroup(ANN, sheep({ lambingStart: '2026-03-01' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('needs both calving dates, with the end on or after the start', async () => {
      await expect(
        s.service.createGroup(
          ANN,
          cattle({ calvingStart: '2026-08-01', calvingEnd: '2026-08-01' }),
        ),
      ).resolves.toBeDefined();
      await expect(
        s.service.createGroup(
          ANN,
          cattle({ calvingStart: '2026-08-02', calvingEnd: '2026-08-01' }),
        ),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        s.service.createGroup(ANN, cattle({ calvingEnd: '2026-08-01' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('rejects a malformed date', async () => {
      await expect(
        s.service.createGroup(ANN, sheep({ lastShearingDate: '2026-02-30' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('accepts a shearing date of today (UK time) and rejects tomorrow', async () => {
      await expect(
        s.service.createGroup(ANN, sheep({ lastShearingDate: '2026-06-01' })),
      ).resolves.toBeDefined();
      await expect(
        s.service.createGroup(ANN, sheep({ lastShearingDate: '2026-06-02' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('records the starting field as the first movement, dated today', async () => {
      const field = await s.service.createField(ANN, { farmId, name: 'Hill' });
      const group = await s.service.createGroup(ANN, sheep({ currentFieldId: field.id }));
      expect(group.currentFieldId).toBe(field.id);
      expect(await s.service.listMovements(group.id)).toMatchObject([
        { fromFieldId: null, toFieldId: field.id, movedOn: '2026-06-01' },
      ]);
    });

    it('rejects a field that belongs to another farm', async () => {
      const other = await s.service.createFarm(ANN, { name: 'Other', postcode: 'SW1A 1AA' });
      const field = await s.service.createField(ANN, { farmId: other.id, name: 'Theirs' });
      await expect(
        s.service.createGroup(ANN, sheep({ currentFieldId: field.id })),
      ).rejects.toMatchObject(code('NOT_FOUND'));
    });

    it('rejects an unknown farm', async () => {
      await expect(s.service.createGroup(ANN, sheep({ farmId: 'nope' }))).rejects.toMatchObject(
        code('NOT_FOUND'),
      );
    });
  });

  describe('updateGroup', () => {
    it('applies a patch and re-validates the result', async () => {
      const group = await s.service.createGroup(ANN, sheep());
      const updated = await s.service.updateGroup(ANN, group.id, {
        headCount: 118,
        housed: true,
        livestockClass: 'RAMS',
      });
      expect(updated).toMatchObject({ headCount: 118, housed: true, livestockClass: 'RAMS' });

      await expect(
        s.service.updateGroup(ANN, group.id, { livestockClass: 'CALVES' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(s.service.updateGroup(ANN, group.id, { headCount: 0 })).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
    });

    it('clears an attribute set to null', async () => {
      const group = await s.service.createGroup(ANN, sheep({ lastShearingDate: '2026-05-20' }));
      expect(
        (await s.service.updateGroup(ANN, group.id, { lastShearingDate: null })).lastShearingDate,
      ).toBeNull();
    });

    it('rejects an unknown group', async () => {
      await expect(s.service.updateGroup(ANN, 'nope', { headCount: 3 })).rejects.toMatchObject(
        code('NOT_FOUND'),
      );
    });
  });

  describe('moveGroup (FR-2.4)', () => {
    async function groupInField() {
      const top = await s.service.createField(ANN, { farmId, name: 'Top' });
      const lower = await s.service.createField(ANN, { farmId, name: 'Lower' });
      const group = await s.service.createGroup(ANN, sheep({ currentFieldId: top.id }));
      return { top, lower, group };
    }

    it('records the move with from/to fields and updates the current field', async () => {
      const { top, lower, group } = await groupInField();
      const move = await s.service.moveGroup(ANN, {
        groupId: group.id,
        toFieldId: lower.id,
        movedOn: '2026-06-01',
      });
      expect(move).toMatchObject({ farmId, fromFieldId: top.id, toFieldId: lower.id });
      expect((await s.service.getGroup(ANN, group.id))!.currentFieldId).toBe(lower.id);
      expect(await s.service.listMovements(group.id)).toHaveLength(2);
    });

    it('keeps history but not the current field for a move dated before the latest one', async () => {
      const { top, lower, group } = await groupInField();
      await s.service.moveGroup(ANN, {
        groupId: group.id,
        toFieldId: lower.id,
        movedOn: '2026-05-01',
      });
      expect((await s.service.getGroup(ANN, group.id))!.currentFieldId).toBe(top.id);
      expect(await s.service.listMovements(group.id)).toHaveLength(2);
    });

    it('moves a group with no field and no history', async () => {
      const lower = await s.service.createField(ANN, { farmId, name: 'Lower' });
      const group = await s.service.createGroup(ANN, sheep());
      const move = await s.service.moveGroup(ANN, {
        groupId: group.id,
        toFieldId: lower.id,
        movedOn: '2026-05-01',
      });
      expect(move.fromFieldId).toBeNull();
      expect((await s.service.getGroup(ANN, group.id))!.currentFieldId).toBe(lower.id);
    });

    it('accepts today (UK time) and rejects a future date', async () => {
      const { lower, group } = await groupInField();
      await expect(
        s.service.moveGroup(ANN, { groupId: group.id, toFieldId: lower.id, movedOn: '2026-06-02' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        s.service.moveGroup(ANN, { groupId: group.id, toFieldId: lower.id, movedOn: 'soon' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('rejects a move into the field the group is already in', async () => {
      const { top, group } = await groupInField();
      await expect(
        s.service.moveGroup(ANN, { groupId: group.id, toFieldId: top.id, movedOn: '2026-06-01' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('rejects an unknown group, or a field on another farm', async () => {
      const { group } = await groupInField();
      const other = await s.service.createFarm(ANN, { name: 'Other', postcode: 'SW1A 1AA' });
      const theirs = await s.service.createField(ANN, { farmId: other.id, name: 'Theirs' });
      await expect(
        s.service.moveGroup(ANN, { groupId: 'nope', toFieldId: theirs.id, movedOn: '2026-06-01' }),
      ).rejects.toMatchObject(code('NOT_FOUND'));
      await expect(
        s.service.moveGroup(ANN, {
          groupId: group.id,
          toFieldId: theirs.id,
          movedOn: '2026-06-01',
        }),
      ).rejects.toMatchObject(code('NOT_FOUND'));
    });
  });

  describe('locateGroup (FR-2.2)', () => {
    it('uses the farm postcode for a housed group in a pinned field', async () => {
      const field = await s.service.createField(ANN, {
        farmId,
        name: 'Hill',
        latitude: 54.1,
        longitude: -2.5,
      });
      const group = await s.service.createGroup(
        ANN,
        sheep({ currentFieldId: field.id, housed: true }),
      );
      expect((await s.service.locateGroup(group)).source).toBe('FARM_POSTCODE');
    });

    it('uses the pin of the group’s field', async () => {
      const field = await s.service.createField(ANN, {
        farmId,
        name: 'Hill',
        postcode: 'SW1A 1AA',
        latitude: 54.1,
        longitude: -2.5,
      });
      const group = await s.service.createGroup(ANN, sheep({ currentFieldId: field.id }));
      expect(await s.service.locateGroup(group)).toEqual({
        source: 'PIN',
        latitude: 54.1,
        longitude: -2.5,
        postcode: null,
      });
    });

    it('looks up the field postcode, then the farm postcode', async () => {
      const field = await s.service.createField(ANN, {
        farmId,
        name: 'Meadow',
        postcode: 'SW1A 1AA',
      });
      const inField = await s.service.createGroup(ANN, sheep({ currentFieldId: field.id }));
      const noField = await s.service.createGroup(
        ANN,
        sheep({ name: 'Housed flock', housed: true }),
      );

      expect(await s.service.locateGroup(inField)).toEqual({
        source: 'FIELD_POSTCODE',
        latitude: WESTMINSTER.latitude,
        longitude: WESTMINSTER.longitude,
        postcode: 'SW1A 1AA',
      });
      expect(await s.service.locateGroup(noField)).toEqual({
        source: 'FARM_POSTCODE',
        latitude: UXBRIDGE.latitude,
        longitude: UXBRIDGE.longitude,
        postcode: 'UB8 3PH',
      });
    });
  });

  describe('managing the farm', () => {
    const field = (name = 'Top field') =>
      s.service.createField(ANN, { farmId, name, postcode: null });

    describe('updateFarm', () => {
      it('renames the farm and changes its postcode, normalised', async () => {
        const updated = await s.service.updateFarm(ANN, farmId, {
          name: ' High Farm ',
          postcode: 'sw1a1aa',
        });
        expect(updated).toEqual({ id: farmId, name: 'High Farm', postcode: 'SW1A 1AA' });
      });

      it('rejects a blank name or unknown postcode, and other users', async () => {
        await expect(s.service.updateFarm(ANN, farmId, { name: ' ' })).rejects.toMatchObject(
          code('BAD_INPUT'),
        );
        await expect(
          s.service.updateFarm(ANN, farmId, { postcode: 'ZZ1 1ZZ' }),
        ).rejects.toMatchObject(code('POSTCODE_NOT_FOUND'));
        await expect(s.service.updateFarm(BOB, farmId, { name: 'Mine' })).rejects.toMatchObject(
          code('NOT_FOUND'),
        );
      });
    });

    describe('deleteFarm', () => {
      it('needs the farm name typed to confirm, ignoring case and spaces', async () => {
        await expect(s.service.deleteFarm(ANN, farmId, 'Hill')).rejects.toMatchObject(
          code('BAD_INPUT'),
        );
        expect(await s.service.deleteFarm(ANN, farmId, ' hill farm ')).toBe(true);
        expect(await s.service.listFarms(ANN)).toEqual([]);
      });

      it("treats someone else's farm as not found", async () => {
        await expect(s.service.deleteFarm(BOB, farmId, 'Hill Farm')).rejects.toMatchObject(
          code('NOT_FOUND'),
        );
      });
    });

    describe('updateField', () => {
      it('renames a field and swaps its postcode for a map pin', async () => {
        const created = await s.service.createField(ANN, {
          farmId,
          name: 'Top field',
          postcode: 'SW1A 1AA',
        });
        const updated = await s.service.updateField(ANN, created.id, {
          name: 'Top meadow',
          postcode: null,
          latitude: 54.1,
          longitude: -2.5,
        });
        expect(updated).toMatchObject({
          name: 'Top meadow',
          postcode: null,
          latitude: 54.1,
          longitude: -2.5,
        });
      });

      it('checks the location like a new field', async () => {
        const created = await field();
        await expect(
          s.service.updateField(ANN, created.id, { latitude: 54.1 }),
        ).rejects.toMatchObject(code('BAD_INPUT'));
        await expect(
          s.service.updateField(ANN, created.id, { latitude: 40, longitude: -2 }),
        ).rejects.toMatchObject(code('BAD_INPUT'));
        await expect(s.service.updateField(BOB, created.id, { name: 'x' })).rejects.toMatchObject(
          code('NOT_FOUND'),
        );
      });
    });

    describe('archiving fields', () => {
      it('hides an archived field from the farm and stops moves into it', async () => {
        const top = await field('Top');
        const archived = await s.service.setFieldArchived(ANN, top.id, true);
        expect(archived.archivedOn).toBe('2026-06-01');
        expect(await s.service.listFields(farmId)).toEqual([]);
        expect((await s.service.listArchivedFields(farmId)).map((f) => f.id)).toEqual([top.id]);

        const group = await s.service.createGroup(ANN, sheep());
        await expect(
          s.service.moveGroup(ANN, { groupId: group.id, toFieldId: top.id, movedOn: '2026-06-01' }),
        ).rejects.toMatchObject(code('BAD_INPUT'));
        await expect(
          s.service.createGroup(ANN, sheep({ currentFieldId: top.id })),
        ).rejects.toMatchObject(code('BAD_INPUT'));

        const restored = await s.service.setFieldArchived(ANN, top.id, false);
        expect(restored.archivedOn).toBeNull();
      });

      it("won't archive a field a group is in", async () => {
        const top = await field('Top');
        await s.service.createGroup(ANN, sheep({ currentFieldId: top.id }));
        await expect(s.service.setFieldArchived(ANN, top.id, true)).rejects.toMatchObject(
          code('BAD_INPUT'),
        );
      });
    });

    describe('archiving groups', () => {
      it('archives a sold group with a date and reason, and restores it', async () => {
        const group = await s.service.createGroup(ANN, sheep());
        const archived = await s.service.archiveGroup(ANN, group.id, {
          archivedOn: '2026-05-30',
          reason: ' Sold at market ',
        });
        expect(archived).toMatchObject({
          archivedOn: '2026-05-30',
          archiveReason: 'Sold at market',
        });
        expect(await s.service.listGroups(farmId)).toEqual([]);
        expect((await s.service.listArchivedGroups(farmId)).map((g) => g.id)).toEqual([group.id]);
        // Still reachable, so its records stay readable
        expect(await s.service.getGroup(ANN, group.id)).toMatchObject({ id: group.id });

        const restored = await s.service.restoreGroup(ANN, group.id);
        expect(restored).toMatchObject({ archivedOn: null, archiveReason: null });
        expect(await s.service.listGroups(farmId)).toHaveLength(1);
      });

      it("doesn't keep its last field from being archived", async () => {
        const top = await field('Top');
        const group = await s.service.createGroup(ANN, sheep({ currentFieldId: top.id }));
        await s.service.archiveGroup(ANN, group.id, { archivedOn: '2026-06-01', reason: 'Sold' });
        await expect(s.service.setFieldArchived(ANN, top.id, true)).resolves.toBeDefined();
      });

      it('needs a reason and a date that is not in the future', async () => {
        const group = await s.service.createGroup(ANN, sheep());
        await expect(
          s.service.archiveGroup(ANN, group.id, { archivedOn: '2026-06-01', reason: ' ' }),
        ).rejects.toMatchObject(code('BAD_INPUT'));
        await expect(
          s.service.archiveGroup(ANN, group.id, { archivedOn: '2026-06-02', reason: 'Sold' }),
        ).rejects.toMatchObject(code('BAD_INPUT'));
        await expect(
          s.service.archiveGroup(BOB, group.id, { archivedOn: '2026-06-01', reason: 'Sold' }),
        ).rejects.toMatchObject(code('NOT_FOUND'));
      });

      it("can't move an archived group", async () => {
        const top = await field('Top');
        const group = await s.service.createGroup(ANN, sheep());
        await s.service.archiveGroup(ANN, group.id, { archivedOn: '2026-06-01', reason: 'Sold' });
        await expect(
          s.service.moveGroup(ANN, { groupId: group.id, toFieldId: top.id, movedOn: '2026-06-01' }),
        ).rejects.toMatchObject(code('BAD_INPUT'));
      });
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache/cache';
import { silentLogger } from '../src/logger';
import { InMemoryFarmRepository } from '../src/repositories/farmRepository';
import { InMemoryRecordsRepository } from '../src/repositories/recordsRepository';
import { createFarmService } from '../src/services/farmService';
import { createLocationService } from '../src/services/locationService';
import { createRecordsService, type TreatmentInput } from '../src/services/recordsService';
import { fakePostcodes } from './fakes';

const ANN = 'user-ann';
const BOB = 'user-bob';
const code = (c: string) => ({ extensions: { code: c } });

describe('recordsService', () => {
  let now: Date;
  let service: ReturnType<typeof createRecordsService>;
  let groupId: string;
  let farmId: string;

  beforeEach(async () => {
    now = new Date('2026-06-28T09:00:00Z');
    const farmService = createFarmService({
      repo: new InMemoryFarmRepository(),
      locations: createLocationService({
        postcodes: fakePostcodes().client,
        cache: new MemoryCache(),
        logger: silentLogger,
      }),
      now: () => now,
    });
    service = createRecordsService({
      records: new InMemoryRecordsRepository(),
      farmService,
      now: () => now,
    });
    farmId = (await farmService.createFarm(ANN, { name: 'Hill Farm', postcode: 'UB8 3PH' })).id;
    groupId = (
      await farmService.createGroup(ANN, {
        farmId,
        name: 'Ewes',
        species: 'SHEEP',
        livestockClass: 'EWES',
        headCount: 50,
      })
    ).id;
  });

  const treatment = (overrides: Partial<TreatmentInput> = {}): TreatmentInput => ({
    groupId,
    date: '2026-06-01',
    productName: '  Product from label ',
    batchNumber: ' B123 ',
    quantityUsed: '',
    animalsTreated: 50,
    administeredBy: 'Ann',
    reason: null,
    meatWithdrawalDays: 28,
    milkWithdrawalDays: null,
    ...overrides,
  });

  describe('recordTreatment (FR-6.1)', () => {
    it('stores a treatment, trimming text and sending blanks as null', async () => {
      const saved = await service.recordTreatment(ANN, treatment());
      expect(saved).toMatchObject({
        farmId,
        groupId,
        productName: 'Product from label',
        batchNumber: 'B123',
        quantityUsed: null,
        reason: null,
        animalsTreated: 50,
      });
    });

    it('accepts part of a group: 1 up to the head count, but not 0 or more than the group', async () => {
      await expect(
        service.recordTreatment(ANN, treatment({ animalsTreated: 1 })),
      ).resolves.toBeDefined();
      await expect(
        service.recordTreatment(ANN, treatment({ animalsTreated: 50 })),
      ).resolves.toBeDefined();
      for (const animalsTreated of [0, 51, 2.5]) {
        await expect(
          service.recordTreatment(ANN, treatment({ animalsTreated })),
        ).rejects.toMatchObject(code('BAD_INPUT'));
      }
    });

    it('needs a product name and who administered it', async () => {
      await expect(
        service.recordTreatment(ANN, treatment({ productName: ' ' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        service.recordTreatment(ANN, treatment({ administeredBy: '' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('accepts withdrawal periods of 0 to 1000 days, and rejects -1, 1001 or fractions', async () => {
      for (const days of [0, 1000]) {
        await expect(
          service.recordTreatment(
            ANN,
            treatment({ meatWithdrawalDays: days, milkWithdrawalDays: days }),
          ),
        ).resolves.toBeDefined();
      }
      for (const days of [-1, 1001, 1.5]) {
        await expect(
          service.recordTreatment(ANN, treatment({ meatWithdrawalDays: days })),
        ).rejects.toMatchObject(code('BAD_INPUT'));
        await expect(
          service.recordTreatment(ANN, treatment({ milkWithdrawalDays: days })),
        ).rejects.toMatchObject(code('BAD_INPUT'));
      }
    });

    it('accepts today (UK time) and rejects a future or malformed date', async () => {
      await expect(
        service.recordTreatment(ANN, treatment({ date: '2026-06-28' })),
      ).resolves.toBeDefined();
      await expect(
        service.recordTreatment(ANN, treatment({ date: '2026-06-29' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        service.recordTreatment(ANN, treatment({ date: '28/06/2026' })),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('treats another user’s group as not found (FR-8.4)', async () => {
      await expect(service.recordTreatment(BOB, treatment())).rejects.toMatchObject(
        code('NOT_FOUND'),
      );
    });
  });

  describe('withdrawal (FR-6.2 acceptance, fixed clock)', () => {
    it('flags the group up to 28 June and clears it on 29 June', async () => {
      await service.recordTreatment(ANN, treatment({ date: '2026-06-01', meatWithdrawalDays: 28 }));

      now = new Date('2026-06-28T22:00:00Z'); // 11pm on 28 June in the UK
      expect(await service.withdrawalFor(groupId)).toEqual({
        inWithdrawal: true,
        meatEnds: '2026-06-29',
        milkEnds: null,
      });

      now = new Date('2026-06-28T23:30:00Z'); // 00:30 on 29 June in the UK
      expect((await service.withdrawalFor(groupId)).inWithdrawal).toBe(false);
    });
  });

  describe('recordObservation (FR-6.6)', () => {
    it('stores a check with a note', async () => {
      const saved = await service.recordObservation(ANN, {
        groupId,
        date: '2026-06-28',
        type: ' Flock inspected ',
        note: '2 struck ewes found',
      });
      expect(saved).toMatchObject({ farmId, type: 'Flock inspected', note: '2 struck ewes found' });
      expect(await service.observationsFor(groupId)).toEqual([saved]);
    });

    it('needs a type and a past or present date, and is scoped to the farm', async () => {
      const base = { groupId, date: '2026-06-28', type: 'Check', note: null };
      await expect(service.recordObservation(ANN, { ...base, type: ' ' })).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
      await expect(
        service.recordObservation(ANN, { ...base, date: '2026-06-29' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(service.recordObservation(BOB, base)).rejects.toMatchObject(code('NOT_FOUND'));
    });
  });

  describe('farmTreatments (FR-6.4)', () => {
    it('lists a farm’s treatments in a date range for its members only', async () => {
      await service.recordTreatment(ANN, treatment({ date: '2026-05-31' }));
      const inRange = await service.recordTreatment(ANN, treatment({ date: '2026-06-10' }));
      expect(await service.farmTreatments(ANN, farmId, '2026-06-01', '2026-06-30')).toEqual([
        inRange,
      ]);
      await expect(
        service.farmTreatments(BOB, farmId, '2026-06-01', '2026-06-30'),
      ).rejects.toMatchObject(code('NOT_FOUND'));
    });

    it('rejects a range that ends before it starts, or bad dates', async () => {
      await expect(
        service.farmTreatments(ANN, farmId, '2026-06-30', '2026-06-01'),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(service.farmTreatments(ANN, farmId, 'June', '2026-06-30')).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
    });
  });
});

import { addDays } from '@bellwether/risk-engine';
import { londonToday } from '../dates';
import type { RegisterEventKind } from '../domain/register';
import type { FarmService, GroupInput } from './farmService';
import type { LocationService } from './locationService';
import type { RecordsService } from './recordsService';
import type { Recorder, RegisterService } from './registerService';
import type { TaskService } from './taskService';

export interface DemoFarmDeps {
  farmService: FarmService;
  registerService: RegisterService;
  recordsService: RecordsService;
  taskService: TaskService;
  locations: LocationService;
  now?: () => Date;
}

/**
 * v3: builds a realistic hill farm so the app can be explored without typing everything in.
 * Everything goes through the normal services, so the demo obeys the same rules as real data.
 * Product names are deliberately generic: Bellwether never names or suggests medicines.
 */
export function createDemoFarmService(deps: DemoFarmDeps) {
  const { farmService, registerService, recordsService, taskService } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async create(user: Recorder, postcode: string) {
      const today = londonToday(now());
      const ago = (days: number) => addDays(today, -days);
      const ahead = (days: number) => addDays(today, days);

      const farm = await farmService.createFarm(user.id, {
        name: 'Fellside Farm (demo)',
        postcode,
      });
      await farmService.updateFarm(user.id, farm.id, {
        cphNumber: '00/000/0000',
        flockMark: 'UK 0000000',
      });

      // Fields pinned around the farm postcode, so the map has something to show.
      const { latitude, longitude } = await deps.locations.findPostcode(farm.postcode);
      const pin = (dLat: number, dLon: number) => ({
        latitude: Math.round((latitude + dLat) * 10000) / 10000,
        longitude: Math.round((longitude + dLon) * 10000) / 10000,
      });
      const field = async (name: string, dLat: number, dLon: number) =>
        (await farmService.createField(user.id, { farmId: farm.id, name, ...pin(dLat, dLon) })).id;
      const topFell = await field('Top Fell', 0.009, -0.006);
      const beckMeadow = await field('Beck Meadow', -0.004, 0.005);
      const longField = await field('Long Field', 0.003, 0.011);
      const homePaddock = await field('Home Paddock', -0.001, -0.002);
      const silage = await field('Silage Ground', -0.008, -0.009);

      const group = async (input: Omit<GroupInput, 'farmId'>) =>
        (await farmService.createGroup(user.id, { ...input, farmId: farm.id })).id;
      const ewes = await group({
        name: 'Mule ewes',
        species: 'SHEEP',
        livestockClass: 'EWES',
        headCount: 243,
        lastShearingDate: ago(120),
        lambingStart: ago(200),
        lambingEnd: ago(170),
      });
      const lambs = await group({
        name: 'Spring lambs',
        species: 'SHEEP',
        livestockClass: 'LAMBS',
        headCount: 60,
        lambsAtGrassThisSpring: true,
      });
      const tups = await group({
        name: 'Tups',
        species: 'SHEEP',
        livestockClass: 'RAMS',
        headCount: 6,
      });
      const cows = await group({
        name: 'Suckler cows',
        species: 'CATTLE',
        livestockClass: 'BEEF_CATTLE',
        headCount: 42,
        calvingStart: ago(230),
        calvingEnd: ago(160),
      });
      await group({
        name: 'Youngstock',
        species: 'CATTLE',
        livestockClass: 'CALVES',
        headCount: 22,
        housed: true,
      });

      const move = (groupId: string, toFieldId: string, days: number) =>
        farmService.moveGroup(user.id, { groupId, toFieldId, movedOn: ago(days) });
      await move(ewes, longField, 60);
      await move(ewes, topFell, 18);
      await move(lambs, beckMeadow, 25);
      await move(tups, homePaddock, 90);
      await move(cows, silage, 40);
      await move(cows, longField, 12);

      const record = (
        groupId: string,
        kind: RegisterEventKind,
        days: number,
        fields: {
          count?: number;
          bornDead?: number;
          value?: number;
          otherParty?: string;
          reference?: string;
          cause?: string;
          note?: string;
        },
      ) => registerService.record(user, { groupId, kind, date: ago(days), ...fields });
      await record(lambs, 'BIRTH', 195, { count: 268, bornDead: 9, note: 'Main lambing' });
      await record(lambs, 'BIRTH', 180, { count: 31, bornDead: 2, note: 'Tail end of lambing' });
      await record(lambs, 'DEATH', 178, { count: 4, cause: 'Hypothermia', reference: 'FS-1042' });
      await record(ewes, 'DEATH', 150, { count: 2, cause: 'Found dead', reference: 'FS-1057' });
      await record(tups, 'MOVE_ON', 45, {
        count: 2,
        otherParty: 'Tup sale, Builth Wells',
        reference: 'MOV-2231',
      });
      await record(lambs, 'WEIGHING', 70, { count: 50, value: 18.6 });
      await record(lambs, 'WEIGHING', 42, { count: 50, value: 25.2 });
      await record(lambs, 'FEC', 50, { count: 10, value: 350, reference: 'Lab 5521' });
      await record(lambs, 'FEC', 20, { count: 10, value: 780, reference: 'Lab 5644' });
      await record(lambs, 'MOVE_OFF', 14, {
        count: 40,
        otherParty: 'Kendal auction mart',
        reference: 'MOV-2302',
      });
      await record(lambs, 'WEIGHING', 14, { count: 50, value: 31.4 });
      await record(ewes, 'BODY_CONDITION', 60, { count: 40, value: 2.5 });
      await record(ewes, 'BODY_CONDITION', 10, { count: 40, value: 3 });
      await record(ewes, 'FEC', 30, { count: 10, value: 120, reference: 'Lab 5600' });
      await record(ewes, 'TAG_REPLACEMENT', 33, {
        count: 3,
        note: 'Lost tags replaced at gathering',
      });
      await record(ewes, 'DEATH', 6, { count: 1, cause: 'Mastitis', reference: 'FS-1123' });
      await record(cows, 'BODY_CONDITION', 21, { count: 42, value: 3 });
      await record(cows, 'DEATH', 80, {
        count: 1,
        cause: 'Calving difficulty',
        reference: 'FS-1088',
      });

      const treat = (
        groupId: string,
        days: number,
        productName: string,
        animalsTreated: number,
        meat: number,
      ) =>
        recordsService.recordTreatment(user.id, {
          groupId,
          date: ago(days),
          productName,
          batchNumber: `D${days}`,
          animalsTreated,
          administeredBy: 'Demo farmer',
          reason: 'Demo record',
          meatWithdrawalDays: meat,
        });
      await treat(lambs, 40, 'Demo fly treatment (as on label)', 60, 7);
      await treat(lambs, 5, 'Demo wormer (as on label)', 55, 14);
      await treat(cows, 25, 'Demo pour-on (as on label)', 41, 28);

      const check = (groupId: string, days: number, type: string, note: string) =>
        recordsService.recordObservation(user.id, { groupId, date: ago(days), type, note });
      await check(ewes, 2, 'Flock inspected', '2 lame ewes, foot check booked');
      await check(lambs, 1, 'Flock inspected', 'All well, grazing good');
      await check(cows, 3, 'Herd check', 'Water trough leaking in Long Field');

      const task = (
        title: string,
        dueDate: string,
        groupId: string | null,
        repeatEveryDays: number | null = null,
      ) =>
        taskService.createTask(user.id, {
          farmId: farm.id,
          groupId,
          title,
          dueDate,
          repeatEveryDays,
        });
      await task('Check water troughs', today, null, 7);
      await task('Foot check on lame ewes', ago(2), ewes);
      await task('Gather lambs for weighing', ahead(5), lambs);
      await task('Fix gate in Beck Meadow', ahead(10), null);
      await task('Tup fertility check', ahead(20), tups);
      const done = await task('Book the shearers', ago(9), null);
      await taskService.setDone(user.id, done.id, true);

      const medicine = (
        productName: string,
        expiry: string,
        meat: number | null,
        quantity: string,
      ) =>
        registerService.addMedicine(user.id, farm.id, {
          productName,
          batchNumber: `B-${expiry.slice(2, 7)}`,
          quantity,
          expiryDate: expiry,
          supplier: 'Local merchant',
          purchasedOn: ago(60),
          meatWithdrawalDays: meat,
        });
      await medicine('Demo wormer (as on label)', ahead(300), 14, '2.5 l');
      await medicine('Demo pour-on (as on label)', ahead(20), 28, '1 l');
      await medicine('Demo fly treatment (as on label)', ago(10), 7, '500 ml');

      return farm;
    },

    /** v3.2: a dairy farm, for the one-click demo account. Fields sit a little east of `postcode`. */
    async createDairy(user: Recorder, postcode: string) {
      const today = londonToday(now());
      const ago = (days: number) => addDays(today, -days);
      const ahead = (days: number) => addDays(today, days);

      const farm = await farmService.createFarm(user.id, {
        name: 'Brookside Dairy (demo)',
        postcode,
      });
      await farmService.updateFarm(user.id, farm.id, {
        cphNumber: '00/000/0001',
        flockMark: 'UK 0000001',
      });

      const { latitude, longitude } = await deps.locations.findPostcode(farm.postcode);
      const field = async (name: string, dLat: number, dLon: number) =>
        (
          await farmService.createField(user.id, {
            farmId: farm.id,
            name,
            latitude: Math.round((latitude + dLat) * 10000) / 10000,
            longitude: Math.round((longitude + 0.03 + dLon) * 10000) / 10000,
          })
        ).id;
      const parlour = await field('Parlour Field', 0.002, 0.001);
      const brook = await field('Brook Pasture', -0.005, 0.006);
      const highLeys = await field('High Leys', 0.007, -0.004);
      await field('Calf Paddock', -0.001, -0.006);

      const group = async (input: Omit<GroupInput, 'farmId'>) =>
        (await farmService.createGroup(user.id, { ...input, farmId: farm.id })).id;
      const milkers = await group({
        name: 'Milking herd',
        species: 'CATTLE',
        livestockClass: 'DAIRY_COWS',
        cattleType: 'DAIRY',
        headCount: 182,
        calvingStart: ago(150),
        calvingEnd: ago(40),
      });
      const dry = await group({
        name: 'Dry cows',
        species: 'CATTLE',
        livestockClass: 'DAIRY_COWS',
        cattleType: 'DAIRY',
        headCount: 31,
      });
      const heifers = await group({
        name: 'In-calf heifers',
        species: 'CATTLE',
        livestockClass: 'DAIRY_COWS',
        cattleType: 'DAIRY',
        headCount: 38,
      });
      const calves = await group({
        name: 'Calves',
        species: 'CATTLE',
        livestockClass: 'CALVES',
        headCount: 20,
        housed: true,
      });

      const move = (groupId: string, toFieldId: string, days: number) =>
        farmService.moveGroup(user.id, { groupId, toFieldId, movedOn: ago(days) });
      await move(milkers, parlour, 35);
      await move(milkers, brook, 9);
      await move(dry, highLeys, 28);
      await move(heifers, parlour, 70);
      await move(heifers, highLeys, 21);

      const record = (
        groupId: string,
        kind: RegisterEventKind,
        days: number,
        fields: {
          count?: number;
          bornDead?: number;
          value?: number;
          otherParty?: string;
          reference?: string;
          cause?: string;
          note?: string;
        },
      ) => registerService.record(user, { groupId, kind, date: ago(days), ...fields });
      await record(calves, 'BIRTH', 140, { count: 46, bornDead: 3, note: 'Spring block calving' });
      await record(calves, 'BIRTH', 60, { count: 18, bornDead: 1, note: 'Late calvers' });
      await record(calves, 'MOVE_OFF', 100, {
        count: 30,
        otherParty: 'Calf rearer, Penrith',
        reference: 'BCMS-8812',
      });
      await record(calves, 'DEATH', 120, { count: 1, cause: 'Scour', reference: 'FS-2201' });
      await record(calves, 'WEIGHING', 90, { count: 20, value: 62 });
      await record(calves, 'WEIGHING', 45, { count: 20, value: 98 });
      await record(calves, 'WEIGHING', 8, { count: 20, value: 131 });
      await record(milkers, 'BODY_CONDITION', 80, { count: 60, value: 2.5 });
      await record(milkers, 'BODY_CONDITION', 30, { count: 60, value: 2.75 });
      await record(milkers, 'BODY_CONDITION', 4, { count: 60, value: 3 });
      await record(milkers, 'DEATH', 55, { count: 1, cause: 'Milk fever', reference: 'FS-2240' });
      await record(heifers, 'MOVE_ON', 75, {
        count: 8,
        otherParty: 'Neighbour, Sedbergh',
        reference: 'BCMS-8930',
      });
      await record(heifers, 'TAG_REPLACEMENT', 16, { count: 2, note: 'Replacement tags fitted' });

      await recordsService.recordTreatment(user.id, {
        groupId: milkers,
        date: ago(12),
        productName: 'Demo footbath product (as on label)',
        batchNumber: 'D12',
        animalsTreated: 181,
        administeredBy: 'Demo farmer',
        reason: 'Demo record',
        meatWithdrawalDays: 0,
      });
      await recordsService.recordTreatment(user.id, {
        groupId: heifers,
        date: ago(3),
        productName: 'Demo wormer (as on label)',
        batchNumber: 'D3',
        animalsTreated: 38,
        administeredBy: 'Demo farmer',
        reason: 'Demo record',
        meatWithdrawalDays: 21,
      });
      await recordsService.recordObservation(user.id, {
        groupId: milkers,
        date: ago(1),
        type: 'Herd check',
        note: 'Three cows lame on back feet, foot trimmer booked',
      });

      for (const [title, due, groupId] of [
        ['Foot trimmer visit', ahead(3), milkers],
        ['Bulk tank service', ahead(8), null],
        ['Dry off next batch', ahead(14), milkers],
        ['Wean calves', ago(1), calves],
      ] as const)
        await taskService.createTask(user.id, {
          farmId: farm.id,
          groupId,
          title,
          dueDate: due,
          repeatEveryDays: null,
        });

      await registerService.addMedicine(user.id, farm.id, {
        productName: 'Demo footbath product (as on label)',
        batchNumber: 'B-FB-01',
        quantity: '25 l',
        expiryDate: ahead(180),
        supplier: 'Local merchant',
        purchasedOn: ago(30),
        meatWithdrawalDays: 0,
      });
      return farm;
    },
  };
}

export type DemoFarmService = ReturnType<typeof createDemoFarmService>;

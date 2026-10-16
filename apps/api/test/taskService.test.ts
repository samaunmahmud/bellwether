import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache/cache';
import { silentLogger } from '../src/logger';
import { InMemoryTaskRepository } from '../src/repositories/briefingRepository';
import { InMemoryFarmRepository } from '../src/repositories/farmRepository';
import { createFarmService } from '../src/services/farmService';
import { createLocationService } from '../src/services/locationService';
import { createTaskService } from '../src/services/taskService';
import { fakePostcodes } from './fakes';

const ANN = 'user-ann';
const BOB = 'user-bob';
const code = (c: string) => ({ extensions: { code: c } });

describe('taskService (FR-5.2, FR-5.5)', () => {
  let tasks: ReturnType<typeof createTaskService>;
  let farmId: string;
  let groupId: string;

  beforeEach(async () => {
    const now = () => new Date('2026-06-10T09:00:00Z');
    const farmService = createFarmService({
      repo: new InMemoryFarmRepository(),
      locations: createLocationService({
        postcodes: fakePostcodes().client,
        cache: new MemoryCache(),
        logger: silentLogger,
      }),
      now,
    });
    tasks = createTaskService({ tasks: new InMemoryTaskRepository(), farmService, now });
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

  const task = (overrides = {}) => ({
    groupId,
    title: '  Check the flock daily for signs of strike ',
    dueDate: '2026-06-11',
    note: null,
    ...overrides,
  });

  it('creates a task for a group, trimming the title', async () => {
    const created = await tasks.createTask(ANN, task());
    expect(created).toMatchObject({
      farmId,
      groupId,
      title: 'Check the flock daily for signs of strike',
      dueDate: '2026-06-11',
      done: false,
    });
    expect(await tasks.listTasks(ANN, farmId)).toEqual([created]);
  });

  it('needs a title and a real date', async () => {
    await expect(tasks.createTask(ANN, task({ title: ' ' }))).rejects.toMatchObject(
      code('BAD_INPUT'),
    );
    await expect(tasks.createTask(ANN, task({ dueDate: 'tomorrow' }))).rejects.toMatchObject(
      code('BAD_INPUT'),
    );
  });

  it('marks tasks done and not done', async () => {
    const created = await tasks.createTask(ANN, task());
    expect((await tasks.setDone(ANN, created.id, true)).done).toBe(true);
    expect((await tasks.setDone(ANN, created.id, false)).done).toBe(false);
  });

  it('lists overdue tasks: not done and due before today (UK date)', async () => {
    const yesterday = await tasks.createTask(ANN, task({ dueDate: '2026-06-09' }));
    await tasks.createTask(ANN, task({ dueDate: '2026-06-10' })); // due today: not overdue
    const doneLate = await tasks.createTask(ANN, task({ dueDate: '2026-06-01' }));
    await tasks.setDone(ANN, doneLate.id, true);

    expect((await tasks.overdue(farmId)).map((t) => t.id)).toEqual([yesterday.id]);
    expect(tasks.isOverdue(yesterday)).toBe(true);
  });

  it('keeps other users out (FR-8.4)', async () => {
    const created = await tasks.createTask(ANN, task());
    await expect(tasks.createTask(BOB, task())).rejects.toMatchObject(code('NOT_FOUND'));
    await expect(tasks.setDone(BOB, created.id, true)).rejects.toMatchObject(code('NOT_FOUND'));
    await expect(tasks.listTasks(BOB, farmId)).rejects.toMatchObject(code('NOT_FOUND'));
    await expect(tasks.setDone(ANN, 'missing', true)).rejects.toMatchObject(code('NOT_FOUND'));
  });

  describe('farm-wide, repeating, editable tasks (FR-5.3)', () => {
    it('creates a farm-wide task with no group', async () => {
      const created = await tasks.createTask(ANN, {
        farmId,
        title: 'Service the quad bike',
        dueDate: '2026-06-20',
      });
      expect(created).toMatchObject({ farmId, groupId: null, repeatEveryDays: null });
    });

    it('needs a farm or a group, and a group must be on that farm', async () => {
      await expect(
        tasks.createTask(ANN, { title: 'X', dueDate: '2026-06-20' }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
      await expect(
        tasks.createTask(ANN, {
          farmId: 'another-farm',
          groupId,
          title: 'X',
          dueDate: '2026-06-20',
        }),
      ).rejects.toMatchObject(code('BAD_INPUT'));
    });

    it('accepts repeats of 1 to 365 days', async () => {
      for (const repeatEveryDays of [1, 365]) {
        await expect(tasks.createTask(ANN, task({ repeatEveryDays }))).resolves.toBeDefined();
      }
      for (const repeatEveryDays of [0, 366, 1.5]) {
        await expect(tasks.createTask(ANN, task({ repeatEveryDays }))).rejects.toMatchObject(
          code('BAD_INPUT'),
        );
      }
    });

    it('makes the next one when a repeating task is done, on the same schedule', async () => {
      // Due 11 June, weekly, done on 10 June: next is due 18 June
      const weekly = await tasks.createTask(ANN, task({ repeatEveryDays: 7, note: 'Trough 3' }));
      const done = await tasks.setDone(ANN, weekly.id, true);
      const list = await tasks.listTasks(ANN, farmId);
      expect(list).toHaveLength(2);
      const next = list.find((t) => t.id !== weekly.id)!;
      expect(next).toMatchObject({
        title: weekly.title,
        groupId,
        note: 'Trough 3',
        dueDate: '2026-06-18',
        repeatEveryDays: 7,
        done: false,
      });
      expect(done.nextTaskId).toBe(next.id);
    });

    it('skips missed dates: the next one is the first scheduled date after today', async () => {
      // Due 1 June, every 3 days, done on 10 June: 4, 7, 10 have passed or are today; next 13 June
      const late = await tasks.createTask(ANN, task({ dueDate: '2026-06-01', repeatEveryDays: 3 }));
      await tasks.setDone(ANN, late.id, true);
      const next = (await tasks.listTasks(ANN, farmId)).find((t) => t.id !== late.id)!;
      expect(next.dueDate).toBe('2026-06-13');
    });

    it('only makes the next one once, even if ticked off again', async () => {
      const weekly = await tasks.createTask(ANN, task({ repeatEveryDays: 7 }));
      await tasks.setDone(ANN, weekly.id, true);
      await tasks.setDone(ANN, weekly.id, false);
      await tasks.setDone(ANN, weekly.id, true);
      expect(await tasks.listTasks(ANN, farmId)).toHaveLength(2);
    });

    it('edits a task: title, date, note, group (null for whole farm) and repeat', async () => {
      const created = await tasks.createTask(ANN, task());
      const updated = await tasks.updateTask(ANN, created.id, {
        title: ' Check feet ',
        dueDate: '2026-06-15',
        groupId: null,
        note: 'Bring the shears',
        repeatEveryDays: 14,
      });
      expect(updated).toMatchObject({
        title: 'Check feet',
        dueDate: '2026-06-15',
        groupId: null,
        note: 'Bring the shears',
        repeatEveryDays: 14,
      });
      await expect(tasks.updateTask(ANN, created.id, { title: ' ' })).rejects.toMatchObject(
        code('BAD_INPUT'),
      );
    });

    it('deletes a task', async () => {
      const created = await tasks.createTask(ANN, task());
      expect(await tasks.deleteTask(ANN, created.id)).toBe(true);
      expect(await tasks.listTasks(ANN, farmId)).toEqual([]);
    });

    it('keeps other users away from editing and deleting (FR-8.4)', async () => {
      const created = await tasks.createTask(ANN, task());
      await expect(tasks.updateTask(BOB, created.id, { title: 'Mine' })).rejects.toMatchObject(
        code('NOT_FOUND'),
      );
      expect(await tasks.deleteTask(BOB, created.id)).toBe(false);
      await expect(
        tasks.createTask(BOB, { farmId, title: 'Mine', dueDate: '2026-06-20' }),
      ).rejects.toMatchObject(code('NOT_FOUND'));
    });
  });
});

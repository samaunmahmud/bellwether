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
});

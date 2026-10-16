import { beforeEach, describe, expect, it } from 'vitest';
import type { BriefingContent } from '../src/domain/briefing';
import type { BriefingRepository, TaskRepository } from '../src/repositories/briefingRepository';

export interface BriefingFixture {
  tasks: TaskRepository;
  briefings: BriefingRepository;
  /** Creates a farm with one livestock group and one member (real rows in Postgres). */
  newFarm(): Promise<{ farmId: string; groupId: string; userId: string }>;
}

const content = (date: string, flaggedCount = 0): BriefingContent => ({
  date,
  generatedAt: `${date}T05:00:00.000Z`,
  groups: [],
  quietGroups: [{ groupId: 'g', groupName: 'Ewes' }],
  flaggedCount,
});

/** Behaviour shared by the in-memory fakes and the Postgres repositories. */
export function briefingRepositoryContract(makeFixture: () => Promise<BriefingFixture>) {
  let f: BriefingFixture;

  beforeEach(async () => {
    f = await makeFixture();
  });

  describe('tasks (FR-5.2)', () => {
    it('creates, lists and completes tasks', async () => {
      const { farmId, groupId } = await f.newFarm();
      const task = await f.tasks.createTask({
        farmId,
        groupId,
        title: 'Check the flock daily for signs of strike',
        dueDate: '2026-06-12',
        note: null,
      });
      expect(task).toEqual({
        id: expect.any(String),
        farmId,
        groupId,
        title: 'Check the flock daily for signs of strike',
        dueDate: '2026-06-12',
        note: null,
        done: false,
        repeatEveryDays: null,
        nextTaskId: null,
        assigneeId: null,
      });
      expect(await f.tasks.getTask(task.id)).toEqual(task);

      const done = await f.tasks.setDone(task.id, true);
      expect(done.done).toBe(true);
      expect((await f.tasks.setDone(task.id, false)).done).toBe(false);
    });

    it('lists a farm’s tasks by due date, earliest first', async () => {
      const { farmId, groupId } = await f.newFarm();
      const later = await f.tasks.createTask({
        farmId,
        groupId,
        title: 'B',
        dueDate: '2026-06-20',
        note: null,
      });
      const sooner = await f.tasks.createTask({
        farmId,
        groupId,
        title: 'A',
        dueDate: '2026-06-01',
        note: 'n',
      });
      const other = await f.newFarm();
      await f.tasks.createTask({
        farmId: other.farmId,
        groupId: other.groupId,
        title: 'Theirs',
        dueDate: '2026-06-01',
        note: null,
      });
      expect((await f.tasks.listTasks(farmId)).map((t) => t.id)).toEqual([sooner.id, later.id]);
    });

    it('stores farm-wide and repeating tasks', async () => {
      const { farmId } = await f.newFarm();
      const task = await f.tasks.createTask({
        farmId,
        groupId: null,
        title: 'Check water troughs',
        dueDate: '2026-06-12',
        note: null,
        repeatEveryDays: 7,
      });
      expect(task).toMatchObject({ groupId: null, repeatEveryDays: 7, nextTaskId: null });
      expect(await f.tasks.getTask(task.id)).toEqual(task);
    });

    it('updates only the given fields, and null clears optional ones', async () => {
      const { farmId, groupId, userId } = await f.newFarm();
      const task = await f.tasks.createTask({
        farmId,
        groupId,
        title: 'A',
        dueDate: '2026-06-12',
        note: 'n',
        repeatEveryDays: 7,
      });
      const next = await f.tasks.createTask({
        farmId,
        groupId,
        title: 'A',
        dueDate: '2026-06-19',
        note: null,
      });
      const updated = await f.tasks.updateTask(task.id, {
        title: 'B',
        groupId: null,
        note: null,
        repeatEveryDays: null,
        nextTaskId: next.id,
        assigneeId: userId,
      });
      expect(updated).toEqual({
        ...task,
        title: 'B',
        groupId: null,
        note: null,
        repeatEveryDays: null,
        nextTaskId: next.id,
        assigneeId: userId,
      });
      expect(await f.tasks.getTask(task.id)).toEqual(updated);
    });

    it('deletes a task', async () => {
      const { farmId, groupId } = await f.newFarm();
      const task = await f.tasks.createTask({
        farmId,
        groupId,
        title: 'A',
        dueDate: '2026-06-12',
        note: null,
      });
      expect(await f.tasks.deleteTask(task.id)).toBe(true);
      expect(await f.tasks.getTask(task.id)).toBeNull();
      expect(await f.tasks.deleteTask(task.id)).toBe(false);
    });

    it('returns null for an unknown task', async () => {
      expect(
        await f.tasks.updateTask('00000000-0000-0000-0000-000000000000', { title: 'x' }),
      ).toBeNull();
      expect(await f.tasks.getTask('00000000-0000-0000-0000-000000000000')).toBeNull();
    });
  });

  describe('briefing runs (FR-4.5)', () => {
    it('stores one run per farm per day, replacing a rerun', async () => {
      const { farmId } = await f.newFarm();
      await f.briefings.saveRun(farmId, content('2026-06-10', 1));
      await f.briefings.saveRun(farmId, content('2026-06-10', 3));
      expect(await f.briefings.getRun(farmId, '2026-06-10')).toEqual(content('2026-06-10', 3));
    });

    it('finds the latest run on or before a date', async () => {
      const { farmId } = await f.newFarm();
      await f.briefings.saveRun(farmId, content('2026-06-08'));
      await f.briefings.saveRun(farmId, content('2026-06-10'));
      expect((await f.briefings.latestRun(farmId))!.date).toBe('2026-06-10');
      expect(await f.briefings.getRun(farmId, '2026-06-09')).toBeNull();
      expect(await f.briefings.latestRun((await f.newFarm()).farmId)).toBeNull();
    });
  });

  describe('email preferences (FR-4.3)', () => {
    it('defaults to 06:00, email on, skip when nothing is flagged', async () => {
      const { farmId, userId } = await f.newFarm();
      expect(await f.briefings.getPreferences(farmId, userId)).toEqual({
        emailEnabled: true,
        sendAt: '06:00',
        alwaysSend: false,
      });
    });

    it('saves and reads back preferences', async () => {
      const { farmId, userId } = await f.newFarm();
      const prefs = { emailEnabled: false, sendAt: '07:30', alwaysSend: true };
      await f.briefings.setPreferences(farmId, userId, prefs);
      expect(await f.briefings.getPreferences(farmId, userId)).toEqual(prefs);
    });
  });

  describe('email claims', () => {
    it('lets each user claim each day’s email exactly once', async () => {
      const { farmId, userId } = await f.newFarm();
      expect(await f.briefings.claimEmail(farmId, userId, '2026-06-10')).toBe(true);
      expect(await f.briefings.claimEmail(farmId, userId, '2026-06-10')).toBe(false);
      expect(await f.briefings.claimEmail(farmId, userId, '2026-06-11')).toBe(true);
    });
  });

  describe('ids that are not UUIDs', () => {
    it('are treated as not found', async () => {
      expect(await f.tasks.getTask('x')).toBeNull();
      expect(await f.tasks.updateTask('x', { title: 'y' })).toBeNull();
      expect(await f.tasks.deleteTask('x')).toBe(false);
      expect(await f.tasks.listTasks('x')).toEqual([]);
      expect(await f.briefings.getRun('x', '2026-06-10')).toBeNull();
      expect(await f.briefings.latestRun('x')).toBeNull();
      expect(await f.briefings.getPreferences('x', 'y')).toEqual({
        emailEnabled: true,
        sendAt: '06:00',
        alwaysSend: false,
      });
    });
  });
}

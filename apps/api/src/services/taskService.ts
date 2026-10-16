import { addDays } from '@bellwether/risk-engine';
import { isIsoDate, londonToday } from '../dates';
import { appError } from '../errors';
import type { Task, TaskPatch, TaskRepository } from '../repositories/briefingRepository';
import type { FarmService } from './farmService';

const MAX_TITLE = 200;
const MAX_NOTE = 1000;
export const MAX_REPEAT_DAYS = 365;

/** A task for a group, or a farm-wide one (FR-5.3): give `groupId`, `farmId` or both. */
export interface TaskInput {
  farmId?: string | null;
  groupId?: string | null;
  title: string;
  dueDate: string;
  note?: string | null;
  repeatEveryDays?: number | null;
}

/** Omitted fields are unchanged; null clears the group (whole farm), note or repeat. */
export interface TaskUpdate {
  title?: string | null;
  dueDate?: string | null;
  note?: string | null;
  groupId?: string | null;
  repeatEveryDays?: number | null;
}

export interface TaskServiceDeps {
  tasks: TaskRepository;
  farmService: FarmService;
  now?: () => Date;
}

function checkTitle(raw: string) {
  const title = raw.trim();
  if (!title || title.length > MAX_TITLE)
    throw appError('BAD_INPUT', `Task title must be 1 to ${MAX_TITLE} characters`);
  return title;
}

function checkDueDate(date: string) {
  if (!isIsoDate(date))
    throw appError('BAD_INPUT', 'Due date must be a date in the form YYYY-MM-DD');
  return date;
}

function checkNote(raw: string | null | undefined) {
  const note = raw?.trim() || null;
  if (note && note.length > MAX_NOTE)
    throw appError('BAD_INPUT', `Note must be ${MAX_NOTE} characters or fewer`);
  return note;
}

function checkRepeat(days: number | null | undefined) {
  if (days == null) return null;
  if (!Number.isInteger(days) || days < 1 || days > MAX_REPEAT_DAYS)
    throw appError(
      'BAD_INPUT',
      `Repeat must be a whole number of days from 1 to ${MAX_REPEAT_DAYS}`,
    );
  return days;
}

/**
 * The next due date of a repeating task: its schedule continued until after `today`,
 * so a task done late doesn't come back already overdue.
 */
export function nextDueDate(dueDate: string, everyDays: number, today: string) {
  let next = addDays(dueDate, everyDays);
  while (next <= today) next = addDays(next, everyDays);
  return next;
}

/** FR-5.2 to FR-5.3 tasks (often one tap from a suggested check) and FR-5.5 overdue tasks. */
export function createTaskService(deps: TaskServiceDeps) {
  const { tasks, farmService } = deps;
  const today = () => londonToday((deps.now ?? (() => new Date()))());
  const isOverdue = (task: Task) => !task.done && task.dueDate < today();

  async function requireFarm(userId: string, farmId: string) {
    if (!(await farmService.getFarm(userId, farmId)))
      throw appError('NOT_FOUND', `Farm ${farmId} not found`);
  }

  /** The task if the user's farm owns it. */
  async function ownTask(userId: string, id: string) {
    const task = await tasks.getTask(id);
    return task && (await farmService.getFarm(userId, task.farmId)) ? task : null;
  }

  async function requireTask(userId: string, id: string) {
    const task = await ownTask(userId, id);
    if (!task) throw appError('NOT_FOUND', `Task ${id} not found`);
    return task;
  }

  /** A group the user can see, on the given farm. */
  async function groupOnFarm(userId: string, groupId: string, farmId: string) {
    const group = await farmService.getGroup(userId, groupId);
    if (!group) throw appError('NOT_FOUND', `Livestock group ${groupId} not found`);
    if (group.farmId !== farmId) throw appError('BAD_INPUT', 'That group is on a different farm');
    return group;
  }

  return {
    isOverdue,

    async createTask(userId: string, input: TaskInput) {
      let farmId = input.farmId ?? null;
      if (input.groupId) {
        const group = await farmService.getGroup(userId, input.groupId);
        if (!group) throw appError('NOT_FOUND', `Livestock group ${input.groupId} not found`);
        if (farmId && group.farmId !== farmId)
          throw appError('BAD_INPUT', 'That group is on a different farm');
        farmId = group.farmId;
      } else if (farmId) {
        await requireFarm(userId, farmId);
      } else {
        throw appError('BAD_INPUT', 'Choose a farm or a group for the task');
      }

      return tasks.createTask({
        farmId,
        groupId: input.groupId || null,
        title: checkTitle(input.title),
        dueDate: checkDueDate(input.dueDate),
        note: checkNote(input.note),
        repeatEveryDays: checkRepeat(input.repeatEveryDays),
      });
    },

    async updateTask(userId: string, id: string, input: TaskUpdate) {
      const task = await requireTask(userId, id);
      const patch: TaskPatch = {};
      if (input.title != null) patch.title = checkTitle(input.title);
      if (input.dueDate != null) patch.dueDate = checkDueDate(input.dueDate);
      if (input.note !== undefined) patch.note = checkNote(input.note);
      if (input.repeatEveryDays !== undefined)
        patch.repeatEveryDays = checkRepeat(input.repeatEveryDays);
      if (input.groupId !== undefined) {
        patch.groupId = input.groupId
          ? (await groupOnFarm(userId, input.groupId, task.farmId)).id
          : null;
      }
      const updated = await tasks.updateTask(id, patch);
      if (!updated) throw appError('NOT_FOUND', `Task ${id} not found`);
      return updated;
    },

    /** Tasks are working notes, not audit records, so they can be deleted. False if not yours. */
    async deleteTask(userId: string, id: string) {
      return (await ownTask(userId, id)) ? tasks.deleteTask(id) : false;
    },

    /** Ticking off a repeating task makes the next one, once (FR-5.3). */
    async setDone(userId: string, taskId: string, done: boolean) {
      const task = await requireTask(userId, taskId);
      const saved = await tasks.setDone(taskId, done);
      if (!done || !task.repeatEveryDays || task.nextTaskId) return saved;

      const next = await tasks.createTask({
        farmId: task.farmId,
        groupId: task.groupId,
        title: task.title,
        note: task.note,
        dueDate: nextDueDate(task.dueDate, task.repeatEveryDays, today()),
        repeatEveryDays: task.repeatEveryDays,
      });
      return (await tasks.updateTask(taskId, { nextTaskId: next.id })) ?? saved;
    },

    async listTasks(userId: string, farmId: string) {
      await requireFarm(userId, farmId);
      return tasks.listTasks(farmId);
    },

    /** FR-5.5: not done and due before today (UK date). For a farm already checked. */
    async overdue(farmId: string) {
      return (await tasks.listTasks(farmId)).filter(isOverdue);
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;

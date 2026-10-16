import { isIsoDate, londonToday } from '../dates';
import { appError } from '../errors';
import type { Task, TaskRepository } from '../repositories/briefingRepository';
import type { FarmService } from './farmService';

const MAX_TITLE = 200;
const MAX_NOTE = 1000;

export interface TaskInput {
  groupId: string;
  title: string;
  dueDate: string;
  note?: string | null;
}

export interface TaskServiceDeps {
  tasks: TaskRepository;
  farmService: FarmService;
  now?: () => Date;
}

/** FR-5.2 tasks (often one tap from a suggested check) and FR-5.5 overdue tasks. */
export function createTaskService(deps: TaskServiceDeps) {
  const { tasks, farmService } = deps;
  const today = () => londonToday((deps.now ?? (() => new Date()))());
  const isOverdue = (task: Task) => !task.done && task.dueDate < today();

  async function requireFarm(userId: string, farmId: string) {
    if (!(await farmService.getFarm(userId, farmId)))
      throw appError('NOT_FOUND', `Farm ${farmId} not found`);
  }

  return {
    isOverdue,

    async createTask(userId: string, input: TaskInput) {
      const group = await farmService.getGroup(userId, input.groupId);
      if (!group) throw appError('NOT_FOUND', `Livestock group ${input.groupId} not found`);
      const title = input.title.trim();
      if (!title || title.length > MAX_TITLE)
        throw appError('BAD_INPUT', `Task title must be 1 to ${MAX_TITLE} characters`);
      if (!isIsoDate(input.dueDate))
        throw appError('BAD_INPUT', 'Due date must be a date in the form YYYY-MM-DD');
      const note = input.note?.trim() || null;
      if (note && note.length > MAX_NOTE)
        throw appError('BAD_INPUT', `Note must be ${MAX_NOTE} characters or fewer`);

      return tasks.createTask({
        farmId: group.farmId,
        groupId: group.id,
        title,
        dueDate: input.dueDate,
        note,
      });
    },

    async setDone(userId: string, taskId: string, done: boolean) {
      const task = await tasks.getTask(taskId);
      if (!task || !(await farmService.getFarm(userId, task.farmId)))
        throw appError('NOT_FOUND', `Task ${taskId} not found`);
      return tasks.setDone(taskId, done);
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

import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import type { BriefingContent } from '../domain/briefing';
import { Prisma } from '../generated/prisma/client';
import {
  DEFAULT_PREFERENCES,
  type BriefingPreferences,
  type BriefingRepository,
  type NewTask,
  type Task,
  type TaskPatch,
  type TaskRepository,
} from './briefingRepository';

// Dates are stored as Postgres DATE columns, which Prisma reads as midnight UTC.
const toDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromDb = (date: Date) => date.toISOString().slice(0, 10);

const taskSelect = {
  id: true,
  farmId: true,
  groupId: true,
  title: true,
  dueDate: true,
  note: true,
  done: true,
  repeatEveryDays: true,
  nextTaskId: true,
} as const;

const toTask = (row: Omit<Task, 'dueDate'> & { dueDate: Date }): Task => ({
  ...row,
  dueDate: fromDb(row.dueDate),
});

export class PrismaTaskRepository implements TaskRepository {
  constructor(private db: PrismaClient) {}

  async createTask(input: NewTask) {
    return toTask(
      await this.db.task.create({
        data: { ...input, dueDate: toDb(input.dueDate) },
        select: taskSelect,
      }),
    );
  }

  async getTask(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.task.findUnique({ where: { id }, select: taskSelect });
    return row ? toTask(row) : null;
  }

  async listTasks(farmId: string) {
    if (!isUuid(farmId)) return [];
    const rows = await this.db.task.findMany({
      where: { farmId },
      orderBy: [{ dueDate: 'asc' }, { seq: 'asc' }],
      select: taskSelect,
    });
    return rows.map(toTask);
  }

  async setDone(id: string, done: boolean) {
    return toTask(await this.db.task.update({ where: { id }, data: { done }, select: taskSelect }));
  }

  async updateTask(id: string, patch: TaskPatch) {
    if (!isUuid(id)) return null;
    const { dueDate, ...rest } = patch;
    const data: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );
    if (dueDate !== undefined) data.dueDate = toDb(dueDate);
    const { count } = await this.db.task.updateMany({ where: { id }, data });
    return count ? this.getTask(id) : null;
  }

  async deleteTask(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.task.deleteMany({ where: { id } });
    return count > 0;
  }
}

export class PrismaBriefingRepository implements BriefingRepository {
  constructor(private db: PrismaClient) {}

  async saveRun(farmId: string, content: BriefingContent) {
    const data = {
      generatedAt: new Date(content.generatedAt),
      content: content as unknown as Prisma.InputJsonValue,
    };
    await this.db.briefingRun.upsert({
      where: { farmId_date: { farmId, date: toDb(content.date) } },
      create: { farmId, date: toDb(content.date), ...data },
      update: data,
    });
  }

  async getRun(farmId: string, date: string) {
    if (!isUuid(farmId)) return null;
    const row = await this.db.briefingRun.findUnique({
      where: { farmId_date: { farmId, date: toDb(date) } },
      select: { content: true },
    });
    return row ? (row.content as unknown as BriefingContent) : null;
  }

  async latestRun(farmId: string) {
    if (!isUuid(farmId)) return null;
    const row = await this.db.briefingRun.findFirst({
      where: { farmId },
      orderBy: { date: 'desc' },
      select: { content: true },
    });
    return row ? (row.content as unknown as BriefingContent) : null;
  }

  async getPreferences(farmId: string, userId: string): Promise<BriefingPreferences> {
    if (!isUuid(farmId) || !isUuid(userId)) return { ...DEFAULT_PREFERENCES };
    const row = await this.db.briefingPreference.findUnique({
      where: { farmId_userId: { farmId, userId } },
      select: { emailEnabled: true, sendAt: true, alwaysSend: true },
    });
    return row ?? { ...DEFAULT_PREFERENCES };
  }

  async setPreferences(farmId: string, userId: string, prefs: BriefingPreferences) {
    await this.db.briefingPreference.upsert({
      where: { farmId_userId: { farmId, userId } },
      create: { farmId, userId, ...prefs },
      update: prefs,
    });
  }

  async claimEmail(farmId: string, userId: string, date: string) {
    try {
      await this.db.briefingEmail.create({ data: { farmId, userId, date: toDb(date) } });
      return true;
    } catch (err) {
      // P2002: already claimed (possibly by another server instance)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
      throw err;
    }
  }
}

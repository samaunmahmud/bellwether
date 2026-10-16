import { randomUUID } from 'node:crypto';
import type { BriefingContent } from '../domain/briefing';

/** FR-5.2: a task, often made from a suggested check with one tap. */
export interface Task {
  id: string;
  farmId: string;
  /** Null for a farm-wide task (FR-5.3) */
  groupId: string | null;
  title: string;
  dueDate: string;
  note: string | null;
  done: boolean;
  /** FR-5.3: when done, the next one is due this many days later on the same schedule */
  repeatEveryDays: number | null;
  /** The follow-up already made for a repeating task, so it's only made once */
  nextTaskId: string | null;
  /** FR-5.4: the farm member it's assigned to */
  assigneeId: string | null;
}

export type NewTask = Omit<
  Task,
  'id' | 'done' | 'repeatEveryDays' | 'nextTaskId' | 'assigneeId'
> & {
  repeatEveryDays?: number | null;
  assigneeId?: string | null;
};

export type TaskPatch = Partial<Omit<Task, 'id' | 'farmId' | 'done'>>;

export interface TaskRepository {
  createTask(input: NewTask): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  /** Earliest due first; ties in the order they were created. */
  listTasks(farmId: string): Promise<Task[]>;
  setDone(id: string, done: boolean): Promise<Task>;
  /** Null if there's no such task. */
  updateTask(id: string, patch: TaskPatch): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;
}

/** FR-4.3: a member's email settings for one farm. */
export interface BriefingPreferences {
  emailEnabled: boolean;
  /** HH:MM, UK time */
  sendAt: string;
  /** Send even when nothing is flagged */
  alwaysSend: boolean;
}

export const DEFAULT_PREFERENCES: BriefingPreferences = {
  emailEnabled: true,
  sendAt: '06:00',
  alwaysSend: false,
};

/** Stored briefing runs (FR-4.5), email preferences and once-a-day email claims (FR-4.3). */
export interface BriefingRepository {
  /** Stores the run for its date, replacing an earlier run for the same day. */
  saveRun(farmId: string, content: BriefingContent): Promise<void>;
  getRun(farmId: string, date: string): Promise<BriefingContent | null>;
  latestRun(farmId: string): Promise<BriefingContent | null>;

  getPreferences(farmId: string, userId: string): Promise<BriefingPreferences>;
  setPreferences(farmId: string, userId: string, prefs: BriefingPreferences): Promise<void>;

  /** True the first time it's called for a user, farm and day; false after that. */
  claimEmail(farmId: string, userId: string, date: string): Promise<boolean>;
}

export class InMemoryTaskRepository implements TaskRepository {
  private tasks: Array<Task & { seq: number }> = [];
  private seq = 0;

  constructor(private newId: () => string = randomUUID) {}

  async createTask(input: NewTask) {
    const task: Task = {
      ...input,
      repeatEveryDays: input.repeatEveryDays ?? null,
      assigneeId: input.assigneeId ?? null,
      id: this.newId(),
      done: false,
      nextTaskId: null,
    };
    this.tasks.push({ ...task, seq: ++this.seq });
    return task;
  }

  async getTask(id: string) {
    const found = this.tasks.find((t) => t.id === id);
    return found ? this.strip(found) : null;
  }

  async listTasks(farmId: string) {
    return this.tasks
      .filter((t) => t.farmId === farmId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.seq - b.seq)
      .map((t) => this.strip(t));
  }

  async setDone(id: string, done: boolean) {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) throw new Error(`Task ${id} not found`);
    found.done = done;
    return this.strip(found);
  }

  async updateTask(id: string, patch: TaskPatch) {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) Object.assign(found, { [key]: value });
    }
    return this.strip(found);
  }

  async deleteTask(id: string) {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return this.tasks.length < before;
  }

  private strip({ seq: _seq, ...task }: Task & { seq: number }): Task {
    return task;
  }
}

export class InMemoryBriefingRepository implements BriefingRepository {
  private runs = new Map<string, BriefingContent>();
  private prefs = new Map<string, BriefingPreferences>();
  private claims = new Set<string>();

  async saveRun(farmId: string, content: BriefingContent) {
    this.runs.set(`${farmId}:${content.date}`, structuredClone(content));
  }

  async getRun(farmId: string, date: string) {
    const run = this.runs.get(`${farmId}:${date}`);
    return run ? structuredClone(run) : null;
  }

  async latestRun(farmId: string) {
    const latest = [...this.runs.entries()]
      .filter(([key]) => key.startsWith(`${farmId}:`))
      .map(([, run]) => run)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest ? structuredClone(latest) : null;
  }

  async getPreferences(farmId: string, userId: string) {
    return { ...(this.prefs.get(`${farmId}:${userId}`) ?? DEFAULT_PREFERENCES) };
  }

  async setPreferences(farmId: string, userId: string, prefs: BriefingPreferences) {
    this.prefs.set(`${farmId}:${userId}`, { ...prefs });
  }

  async claimEmail(farmId: string, userId: string, date: string) {
    const key = `${farmId}:${userId}:${date}`;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }
}

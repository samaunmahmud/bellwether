import { requireUser, type GraphQLContext } from '../auth/context';
import type { Farm } from '../domain/farm';
import { appError } from '../errors';
import type {
  BriefingPreferences,
  BriefingRepository,
  Task,
} from '../repositories/briefingRepository';
import type { BriefingService, BriefingView } from '../services/briefingService';
import type { FarmService } from '../services/farmService';
import type { TaskInput, TaskService, TaskUpdate } from '../services/taskService';

const SEND_AT = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface BriefingResolverDeps {
  farmService: FarmService;
  taskService: TaskService;
  briefingService: BriefingService;
  briefings: BriefingRepository;
}

type BriefingParent = BriefingView & { farmId: string };

/** The farm morning briefing, tasks and email preferences (FR-4, FR-5), scoped per farm. */
export function createBriefingResolvers(deps: BriefingResolverDeps) {
  const { farmService, taskService, briefingService, briefings } = deps;

  async function requireFarm(ctx: GraphQLContext, farmId: string): Promise<Farm> {
    const farm = await farmService.getFarm(requireUser(ctx).id, farmId);
    if (!farm) throw appError('NOT_FOUND', `Farm ${farmId} not found`);
    return farm;
  }

  return {
    Query: {
      briefing: async (_: unknown, args: { farmId: string }, ctx: GraphQLContext) => {
        const view = await briefingService.briefingFor(requireUser(ctx).id, args.farmId);
        return view && { ...view, farmId: args.farmId };
      },
      tasks: (_: unknown, args: { farmId: string }, ctx: GraphQLContext) =>
        taskService.listTasks(requireUser(ctx).id, args.farmId),
      briefingPreferences: async (_: unknown, args: { farmId: string }, ctx: GraphQLContext) => {
        await requireFarm(ctx, args.farmId);
        return briefings.getPreferences(args.farmId, requireUser(ctx).id);
      },
    },

    Mutation: {
      refreshBriefing: async (_: unknown, args: { farmId: string }, ctx: GraphQLContext) => ({
        ...(await briefingService.refresh(requireUser(ctx).id, args.farmId)),
        farmId: args.farmId,
      }),
      createTask: (_: unknown, args: { input: TaskInput }, ctx: GraphQLContext) =>
        taskService.createTask(requireUser(ctx).id, args.input),
      setTaskDone: (_: unknown, args: { id: string; done: boolean }, ctx: GraphQLContext) =>
        taskService.setDone(requireUser(ctx).id, args.id, args.done),
      updateTask: (_: unknown, args: { id: string; input: TaskUpdate }, ctx: GraphQLContext) =>
        taskService.updateTask(requireUser(ctx).id, args.id, args.input),
      deleteTask: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        taskService.deleteTask(requireUser(ctx).id, args.id),
      setBriefingPreferences: async (
        _: unknown,
        args: { farmId: string; input: BriefingPreferences },
        ctx: GraphQLContext,
      ) => {
        await requireFarm(ctx, args.farmId);
        if (!SEND_AT.test(args.input.sendAt))
          throw appError('BAD_INPUT', 'Send time must be HH:MM in 24-hour time, e.g. 06:00');
        await briefings.setPreferences(args.farmId, requireUser(ctx).id, args.input);
        return args.input;
      },
    },

    Briefing: {
      farm: (b: BriefingParent, _: unknown, ctx: GraphQLContext) =>
        farmService.getFarm(requireUser(ctx).id, b.farmId),
      /** FR-5.5: live, so ticking a task off updates the briefing straight away */
      overdueTasks: (b: BriefingParent) => taskService.overdue(b.farmId),
    },

    Task: {
      overdue: (task: Task) => taskService.isOverdue(task),
      group: (task: Task, _: unknown, ctx: GraphQLContext) =>
        task.groupId ? farmService.getGroup(requireUser(ctx).id, task.groupId) : null,
    },
  };
}

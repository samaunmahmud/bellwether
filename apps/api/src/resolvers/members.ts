import { requireUser, type GraphQLContext } from '../auth/context';
import type { Farm, FarmRole } from '../domain/farm';
import { appError } from '../errors';
import type { Task } from '../repositories/briefingRepository';
import type { UserRepository } from '../repositories/userRepository';
import type { FarmService } from '../services/farmService';
import type { MemberService, MemberView } from '../services/memberService';

export interface MemberResolverDeps {
  farmService: FarmService;
  memberService: MemberService;
  users: UserRepository;
}

/** FR-8.2 farm sharing, and FR-5.4 task assignees. */
export function createMemberResolvers({ farmService, memberService, users }: MemberResolverDeps) {
  return {
    Query: {
      myInvites: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        memberService.myInvites(requireUser(ctx)),
    },

    Mutation: {
      inviteMember: (
        _: unknown,
        args: { farmId: string; email: string; role: FarmRole },
        ctx: GraphQLContext,
      ) => memberService.invite(requireUser(ctx), args.farmId, args.email, args.role),
      cancelInvite: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        memberService.cancelInvite(requireUser(ctx).id, args.id),
      acceptInvite: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        memberService.acceptInvite(requireUser(ctx), args.id),
      declineInvite: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        memberService.declineInvite(requireUser(ctx), args.id),
      setMemberRole: (
        _: unknown,
        args: { farmId: string; userId: string; role: FarmRole },
        ctx: GraphQLContext,
      ) => memberService.setRole(requireUser(ctx).id, args.farmId, args.userId, args.role),
      removeMember: (_: unknown, args: { farmId: string; userId: string }, ctx: GraphQLContext) =>
        memberService.remove(requireUser(ctx).id, args.farmId, args.userId),
    },

    Farm: {
      myRole: async (farm: Farm, _: unknown, ctx: GraphQLContext) => {
        const role = await farmService.getRole(farm.id, requireUser(ctx).id);
        if (!role) throw appError('NOT_FOUND', `Farm ${farm.id} not found`);
        return role;
      },
      members: (farm: Farm) => memberService.members(farm.id),
      invites: (farm: Farm) => memberService.invitesFor(farm.id),
    },

    FarmMember: {
      isMe: (member: MemberView, _: unknown, ctx: GraphQLContext) =>
        member.userId === requireUser(ctx).id,
    },

    Task: {
      assignee: (task: Task) => (task.assigneeId ? users.getUser(task.assigneeId) : null),
      assignedToMe: (task: Task, _: unknown, ctx: GraphQLContext) =>
        task.assigneeId === requireUser(ctx).id,
    },
  };
}

import type { FarmRole } from '../domain/farm';
import { escapeHtml } from '../email/briefingEmail';
import type { EmailSender } from '../email/emailSender';
import { appError } from '../errors';
import type { Logger } from '../logger';
import type { TaskRepository } from '../repositories/briefingRepository';
import type { FarmRepository } from '../repositories/farmRepository';
import type { User, UserRepository } from '../repositories/userRepository';
import type { FarmService } from './farmService';

// Deliberately loose: one @, something either side, a dot in the domain.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normaliseEmail = (email: string) => email.trim().toLowerCase();

export interface MemberServiceDeps {
  farms: FarmRepository;
  users: UserRepository;
  tasks: TaskRepository;
  farmService: FarmService;
  email: EmailSender;
  logger: Logger;
  appUrl: string;
}

export interface MemberView {
  userId: string;
  email: string;
  role: FarmRole;
}

/** FR-8.2: sharing a farm with workers and viewers, by email invitation. */
export function createMemberService(deps: MemberServiceDeps) {
  const { farms, users, farmService } = deps;

  async function members(farmId: string): Promise<MemberView[]> {
    const rows = await farms.listMembers(farmId);
    const withEmails = await Promise.all(
      rows.map(async (m) => ({ ...m, email: (await users.getUser(m.userId))?.email ?? '' })),
    );
    return withEmails;
  }

  /** Refuses a change that would leave the farm without an owner. */
  async function keepAnOwner(farmId: string, userId: string, newRole: FarmRole | null) {
    const rows = await farms.listMembers(farmId);
    const owners = rows.filter((m) => m.role === 'OWNER');
    const isOwner = owners.some((m) => m.userId === userId);
    if (isOwner && owners.length === 1 && newRole !== 'OWNER')
      throw appError(
        'BAD_INPUT',
        'A farm needs at least one owner. Make someone else an owner first.',
      );
  }

  /**
   * FR-5.4: tasks only go to people who can do them. Someone made a viewer loses their open
   * tasks; someone who leaves loses all of them, so their email isn't shown on the farm.
   */
  async function unassign(farmId: string, userId: string, openOnly: boolean) {
    const theirs = (await deps.tasks.listTasks(farmId)).filter(
      (t) => t.assigneeId === userId && !(openOnly && t.done),
    );
    await Promise.all(theirs.map((t) => deps.tasks.updateTask(t.id, { assigneeId: null })));
  }

  async function sendInviteEmail(to: string, farmName: string, role: FarmRole, from: User) {
    const roleText = { OWNER: 'an owner', WORKER: 'a worker', VIEWER: 'a viewer' }[role];
    const link = `${deps.appUrl}/farms`;
    try {
      await deps.email.send({
        to,
        subject: `You're invited to ${farmName} on Bellwether`,
        text:
          `${from.email} has invited you to join ${farmName} on Bellwether as ${roleText}.\n\n` +
          `Sign up or log in with this email address, then accept the invitation on your farms page:\n${link}\n`,
        html:
          `<p>${escapeHtml(from.email)} has invited you to join <strong>${escapeHtml(farmName)}</strong> ` +
          `on Bellwether as ${roleText}.</p>` +
          `<p>Sign up or log in with this email address, then accept the invitation on your ` +
          `<a href="${link}">farms page</a>.</p>`,
      });
    } catch (err) {
      // The invite still stands; the invitee sees it when they sign in.
      deps.logger.warn(`invite email failed: ${(err as Error).message}`);
    }
  }

  return {
    members,
    invitesFor: (farmId: string) => farms.listInvitesForFarm(farmId),

    async invite(user: User, farmId: string, rawEmail: string, role: FarmRole) {
      const farm = await farmService.requireFarm(user.id, farmId, 'manage');
      const email = normaliseEmail(rawEmail);
      if (!EMAIL.test(email)) throw appError('BAD_INPUT', 'Enter a valid email address');
      if ((await members(farmId)).some((m) => m.email === email))
        throw appError('BAD_INPUT', `${email} is already a member of this farm`);
      const invite = await farms.createInvite({ farmId, email, role, invitedById: user.id });
      await sendInviteEmail(email, farm.name, role, user);
      return invite;
    },

    async cancelInvite(userId: string, inviteId: string) {
      const invite = await farms.getInvite(inviteId);
      if (!invite || !(await farmService.getFarm(userId, invite.farmId))) return false;
      await farmService.requireFarm(userId, invite.farmId, 'manage');
      return farms.deleteInvite(inviteId);
    },

    /** Invites for the signed-in user's email, with the farm and inviter for display. */
    async myInvites(user: User) {
      const invites = await farms.listInvitesForEmail(user.email);
      return Promise.all(
        invites.map(async (invite) => ({
          id: invite.id,
          role: invite.role,
          farmName: (await farms.getFarm(invite.farmId))?.name ?? '',
          invitedBy: invite.invitedById
            ? ((await users.getUser(invite.invitedById))?.email ?? null)
            : null,
        })),
      );
    },

    async acceptInvite(user: User, inviteId: string) {
      const invite = await farms.getInvite(inviteId);
      if (!invite || invite.email !== user.email)
        throw appError('NOT_FOUND', `Invitation ${inviteId} not found`);
      if (!(await farms.getRole(invite.farmId, user.id)))
        await farms.addMember(invite.farmId, user.id, invite.role);
      await farms.deleteInvite(inviteId);
      const farm = await farms.getFarm(invite.farmId);
      if (!farm) throw appError('NOT_FOUND', `Invitation ${inviteId} not found`);
      return farm;
    },

    async declineInvite(user: User, inviteId: string) {
      const invite = await farms.getInvite(inviteId);
      if (!invite || invite.email !== user.email) return false;
      return farms.deleteInvite(inviteId);
    },

    async setRole(userId: string, farmId: string, memberId: string, role: FarmRole) {
      await farmService.requireFarm(userId, farmId, 'manage');
      if (!(await farms.getRole(farmId, memberId)))
        throw appError('NOT_FOUND', 'That person is not a member of this farm');
      await keepAnOwner(farmId, memberId, role);
      const changed = await farms.setMemberRole(farmId, memberId, role);
      if (role === 'VIEWER') await unassign(farmId, memberId, true);
      return changed;
    },

    /** Owners can remove anyone; any member can remove themselves (leave). */
    async remove(userId: string, farmId: string, memberId: string) {
      await farmService.requireFarm(userId, farmId, memberId === userId ? 'view' : 'manage');
      if (!(await farms.getRole(farmId, memberId))) return false;
      await keepAnOwner(farmId, memberId, null);
      const removed = await farms.removeMember(farmId, memberId);
      await unassign(farmId, memberId, false);
      return removed;
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;

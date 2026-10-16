import { londonTime, londonToday } from '../dates';
import type { AppServices } from '../app';
import { renderBriefingEmail } from '../email/briefingEmail';
import type { EmailSender } from '../email/emailSender';
import type { Logger } from '../logger';
import type { BriefingRepository } from '../repositories/briefingRepository';
import type { FarmRepository } from '../repositories/farmRepository';
import type { UserRepository } from '../repositories/userRepository';

export interface BriefingJobDeps {
  services: AppServices;
  farms: FarmRepository;
  users: UserRepository;
  briefings: BriefingRepository;
  email: EmailSender;
  logger: Logger;
  appUrl: string;
  now?: () => Date;
}

/**
 * FR-4.5 and FR-4.3: run every few minutes. Makes sure each farm has today's briefing stored,
 * then emails each member once their chosen time (UK) has passed. Each email is claimed in the
 * database before sending, so it goes out at most once even with several servers.
 */
export function createBriefingJob(deps: BriefingJobDeps) {
  const now = deps.now ?? (() => new Date());
  const { briefingService, taskService, farmService } = deps.services;

  async function runForFarm(farmId: string, today: string, time: string) {
    let content = await deps.briefings.getRun(farmId, today);
    let generated = false;
    if (!content) {
      try {
        content = await briefingService.generate(farmId);
        generated = true;
      } catch (err) {
        deps.logger.warn(`briefing job: farm ${farmId} skipped: ${(err as Error).message}`);
        return { generated, sent: 0 };
      }
    }
    const briefing = content;

    let sent = 0;
    for (const member of await deps.farms.listMembers(farmId)) {
      const prefs = await deps.briefings.getPreferences(farmId, member.userId);
      if (!prefs.emailEnabled || time < prefs.sendAt) continue;

      const overdue = await taskService.overdue(farmId);
      const worthSending = briefing.flaggedCount > 0 || overdue.length > 0 || prefs.alwaysSend;
      // Claim even when skipping, so a quiet day isn't re-checked every few minutes.
      if (!(await deps.briefings.claimEmail(farmId, member.userId, today)) || !worthSending)
        continue;

      const [user, farm] = await Promise.all([
        deps.users.getUser(member.userId),
        farmService.getFarm(member.userId, farmId),
      ]);
      if (!user || !farm) continue;

      const groupNames = new Map<string, string>(
        briefing.groups.map((g) => [g.groupId, g.groupName]),
      );
      for (const g of await farmService.listGroups(farmId)) groupNames.set(g.id, g.name);
      try {
        await deps.email.send({
          to: user.email,
          ...renderBriefingEmail({
            farmName: farm.name,
            farmId,
            content: briefing,
            appUrl: deps.appUrl,
            overdueTasks: overdue.map((t) => ({
              title: t.title,
              dueDate: t.dueDate,
              groupName: groupNames.get(t.groupId) ?? '',
            })),
          }),
        });
        sent++;
      } catch (err) {
        deps.logger.warn(`briefing email for farm ${farmId} failed: ${(err as Error).message}`);
      }
    }
    return { generated, sent };
  }

  return {
    async runOnce() {
      const at = now();
      const today = londonToday(at);
      const time = londonTime(at);
      const summary = { farms: 0, generated: 0, sent: 0 };
      for (const farmId of await deps.farms.listFarmIds()) {
        const result = await runForFarm(farmId, today, time);
        summary.farms++;
        summary.generated += Number(result.generated);
        summary.sent += result.sent;
      }
      return summary;
    },
  };
}

export type BriefingJob = ReturnType<typeof createBriefingJob>;

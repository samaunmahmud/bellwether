import { londonTime, londonToday } from '../dates';
import { currentPlan, remindersDue } from '../domain/petReminders';
import type { EmailSender } from '../email/emailSender';
import { renderPetReminderEmail, type PetReminders } from '../email/petReminderEmail';
import type { Logger } from '../logger';
import type { Animal, AnimalRepository } from '../repositories/animalRepository';
import type { UserRepository } from '../repositories/userRepository';

/** UK time after which the day's reminders go out. */
export const PET_REMINDER_SEND_AT = '07:00';

export interface PetReminderJobDeps {
  animals: AnimalRepository;
  users: UserRepository;
  email: EmailSender;
  logger: Logger;
  appUrl: string;
  now?: () => Date;
}

/**
 * v3: emails pet owners when a health-plan item is a week away, due today or 3 days late.
 * One email per owner per UK day, claimed before sending so it goes out at most once.
 */
export function createPetReminderJob(deps: PetReminderJobDeps) {
  const now = deps.now ?? (() => new Date());

  return {
    async runOnce() {
      const at = now();
      const summary = { owners: 0, sent: 0 };
      if (londonTime(at) < PET_REMINDER_SEND_AT) return summary;
      const today = londonToday(at);

      const byOwner = new Map<string, Animal[]>();
      for (const pet of await deps.animals.listAnimalsWithReminders())
        byOwner.set(pet.ownerId, [...(byOwner.get(pet.ownerId) ?? []), pet]);

      for (const [ownerId, pets] of byOwner) {
        summary.owners++;
        const due: PetReminders[] = [];
        for (const pet of pets) {
          const items = remindersDue(currentPlan(await deps.animals.listLogs(pet.id), today));
          if (items.length) due.push({ petId: pet.id, petName: pet.name, items });
        }
        if (!due.length || !(await deps.animals.claimReminderEmail(ownerId, today))) continue;
        const user = await deps.users.getUser(ownerId);
        if (!user) continue;
        try {
          await deps.email.send({
            to: user.email,
            ...renderPetReminderEmail({ pets: due, appUrl: deps.appUrl }),
          });
          summary.sent++;
        } catch (err) {
          deps.logger.warn(`pet reminder email failed: ${(err as Error).message}`);
        }
      }
      return summary;
    },
  };
}

export type PetReminderJob = ReturnType<typeof createPetReminderJob>;

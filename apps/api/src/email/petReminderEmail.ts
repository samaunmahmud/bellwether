import { shortDay } from '../dates';
import { dueText, type PlanItem } from '../domain/petReminders';
import { escapeHtml } from './briefingEmail';

const DISCLAIMER = 'This is an awareness tool, not veterinary advice. Speak to your vet.';

export interface PetReminders {
  petId: string;
  petName: string;
  items: PlanItem[];
}

function subjectFor(pets: PetReminders[]) {
  const items = pets.flatMap((p) => p.items.map((item) => ({ pet: p.petName, item })));
  if (items.length === 1) {
    const { pet, item } = items[0]!;
    return `${pet}: ${item.type} ${dueText(item.days)}`;
  }
  return `Pet reminders: ${items.length} due`;
}

/** v3: one email per owner listing what's due for each pet that has reminders on. */
export function renderPetReminderEmail(input: { pets: PetReminders[]; appUrl: string }) {
  const lines: string[] = [];
  const html: string[] = [];
  for (const pet of input.pets) {
    const link = `${input.appUrl}/pets/${pet.petId}`;
    lines.push(pet.petName);
    html.push(`<h2>${escapeHtml(pet.petName)}</h2><ul>`);
    for (const item of pet.items) {
      const line = `${item.type}: ${dueText(item.days)} (${shortDay(item.nextDueDate)})`;
      lines.push(`- ${line}`);
      html.push(`<li>${escapeHtml(line)}</li>`);
    }
    lines.push(`Open ${pet.petName}'s page: ${link}`, '');
    html.push(
      `</ul><p><a href="${escapeHtml(link)}">Open ${escapeHtml(pet.petName)}'s page</a></p>`,
    );
  }
  lines.push(
    'You get these because reminders are turned on for these pets. Turn them off on each pet’s page.',
    '',
    DISCLAIMER,
  );
  html.push(
    '<p>You get these because reminders are turned on for these pets. Turn them off on each pet’s page.</p>',
    `<p><small>${DISCLAIMER}</small></p>`,
  );
  return { subject: subjectFor(input.pets), text: lines.join('\n'), html: html.join('\n') };
}

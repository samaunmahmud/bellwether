import { shortDay } from '../dates';
import type { BriefingContent } from '../domain/briefing';

const DISCLAIMER = 'This is an awareness tool, not veterinary advice. Speak to your vet.';
const LEVEL_WORD = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' } as const;

export interface OverdueTaskLine {
  title: string;
  dueDate: string;
  groupName: string;
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function subjectFor(farmName: string, content: BriefingContent): string {
  const items = content.groups.flatMap((g) => g.items);
  const high = items.filter((i) => i.level === 'HIGH').length;
  const medium = items.length - high;
  const counts = [high && `${high} High`, medium && `${medium} Medium`].filter(Boolean);
  const summary = counts.length ? counts.join(', ') : 'no concerns this week';
  return `${farmName} briefing, ${shortDay(content.date)}: ${summary}`;
}

/** FR-4.3: the same content as the briefing page, as plain text and simple HTML. */
export function renderBriefingEmail(input: {
  farmName: string;
  farmId: string;
  content: BriefingContent;
  overdueTasks: OverdueTaskLine[];
  appUrl: string;
}) {
  const { content } = input;
  const link = `${input.appUrl}/farms/${input.farmId}/briefing`;
  const lines: string[] = [];
  const html: string[] = [];

  if (input.overdueTasks.length) {
    lines.push('OVERDUE TASKS');
    html.push('<h2>Overdue tasks</h2><ul>');
    for (const t of input.overdueTasks) {
      const line = `${t.title} (${t.groupName}), due ${shortDay(t.dueDate)}`;
      lines.push(`- ${line}`);
      html.push(`<li>${escapeHtml(line)}</li>`);
    }
    lines.push('');
    html.push('</ul>');
  }

  for (const group of content.groups) {
    const heading = group.fieldName ? `${group.groupName} · ${group.fieldName}` : group.groupName;
    lines.push(heading);
    html.push(`<h2>${escapeHtml(heading)}</h2>`);
    for (const item of group.items) {
      const title = `${item.level}${item.isNew ? ' (New)' : ''}: ${item.riskName}`;
      const days = item.daysAffected
        .map((d) => `${shortDay(d.date)} (${LEVEL_WORD[d.level]})`)
        .join(', ');
      lines.push(`  ${title}`, `  Days: ${days}`, `  ${item.reason}`);
      lines.push(...item.checks.map((c) => `  - ${c}`), '');
      html.push(
        `<h3>${escapeHtml(title)}</h3>`,
        `<p>Days: ${escapeHtml(days)}</p>`,
        `<p>${escapeHtml(item.reason)}</p>`,
        `<ul>${item.checks.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`,
      );
    }
  }

  if (content.quietGroups.length) {
    const quiet = `No concerns this week: ${content.quietGroups.map((g) => g.groupName).join(', ')}`;
    lines.push(quiet, '');
    html.push(`<p>${escapeHtml(quiet)}</p>`);
  }

  lines.push(`Open the briefing: ${link}`, '', DISCLAIMER);
  html.push(
    `<p><a href="${escapeHtml(link)}">Open the briefing</a></p>`,
    `<p><small>${DISCLAIMER}</small></p>`,
  );

  return {
    subject: subjectFor(input.farmName, content),
    text: lines.join('\n'),
    html: html.join('\n'),
  };
}

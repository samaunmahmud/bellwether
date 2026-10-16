import { describe, expect, it } from 'vitest';
import { londonTime } from '../src/dates';
import type { BriefingContent } from '../src/domain/briefing';
import { renderBriefingEmail } from '../src/email/briefingEmail';

const content: BriefingContent = {
  date: '2026-06-10',
  generatedAt: '2026-06-10T05:00:00.000Z',
  flaggedCount: 2,
  groups: [
    {
      groupId: 'g1',
      groupName: 'North <flock>',
      fieldName: 'Top field',
      items: [
        {
          riskId: 'sheep-blowfly',
          riskName: 'Sheep blowfly strike',
          level: 'HIGH',
          daysAffected: [
            { date: '2026-06-10', level: 'HIGH' },
            { date: '2026-06-11', level: 'MEDIUM' },
          ],
          reason: 'Warm and humid: blowfly strike risk high',
          checks: ['Check the flock daily for signs of strike'],
          isNew: true,
        },
        {
          riskId: 'liver-fluke',
          riskName: 'Liver fluke season',
          level: 'MEDIUM',
          daysAffected: [{ date: '2026-06-10', level: 'MEDIUM' }],
          reason: 'Fluke season index 320',
          checks: ['Discuss fluke testing with your vet or adviser'],
          isNew: false,
        },
      ],
    },
  ],
  quietGroups: [{ groupId: 'g2', groupName: 'Dairy herd' }],
};

const render = (overrides: Partial<Parameters<typeof renderBriefingEmail>[0]> = {}) =>
  renderBriefingEmail({
    farmName: 'Hill Farm',
    content,
    overdueTasks: [
      { title: 'Check water troughs', dueDate: '2026-06-08', groupName: 'Dairy herd' },
    ],
    appUrl: 'https://bellwether.example',
    farmId: 'farm1',
    ...overrides,
  });

describe('renderBriefingEmail (FR-4.3)', () => {
  it('summarises the counts in the subject', () => {
    expect(render().subject).toBe('Hill Farm briefing, Wed 10 Jun: 1 High, 1 Medium');
  });

  it('says when nothing is flagged', () => {
    const quiet = { ...content, groups: [], flaggedCount: 0 };
    expect(render({ content: quiet, overdueTasks: [] }).subject).toBe(
      'Hill Farm briefing, Wed 10 Jun: no concerns this week',
    );
  });

  it('includes everything the page shows, with levels in words', () => {
    const { text } = render();
    for (const expected of [
      'OVERDUE TASKS',
      'Check water troughs (Dairy herd), due Mon 8 Jun',
      'North <flock> · Top field',
      'HIGH (New): Sheep blowfly strike',
      'Days: Wed 10 Jun (High), Thu 11 Jun (Medium)',
      'Warm and humid: blowfly strike risk high',
      '- Check the flock daily for signs of strike',
      'MEDIUM: Liver fluke season',
      'No concerns this week: Dairy herd',
      'https://bellwether.example/farms/farm1/briefing',
      'This is an awareness tool, not veterinary advice. Speak to your vet.',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('escapes farm text in the HTML version', () => {
    const { html } = render();
    expect(html).toContain('North &lt;flock&gt;');
    expect(html).not.toContain('North <flock>');
    expect(html).toContain('HIGH');
    expect(html).toContain('not veterinary advice');
  });
});

describe('londonTime', () => {
  it('gives the UK wall-clock time as HH:MM', () => {
    expect(londonTime(new Date('2026-06-10T05:00:00Z'))).toBe('06:00'); // BST
    expect(londonTime(new Date('2026-01-10T06:30:00Z'))).toBe('06:30'); // GMT
    expect(londonTime(new Date('2026-06-09T23:05:00Z'))).toBe('00:05');
  });
});

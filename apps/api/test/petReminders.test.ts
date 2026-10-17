import { describe, expect, it } from 'vitest';
import { currentPlan, remindersDue } from '../src/domain/petReminders';
import type { LogEntry } from '../src/repositories/animalRepository';
import { buildTestApp } from './fakes';

const log = (over: Partial<LogEntry>): LogEntry => ({
  id: over.id ?? `${over.type}-${over.date}`,
  animalId: 'pet',
  date: '2026-05-01',
  type: 'Worming',
  note: null,
  nextDueDate: null,
  weightKg: null,
  ...over,
});

describe('pet health plan (domain)', () => {
  it('keeps only the latest entry of each type that has a next due date, soonest first', () => {
    const plan = currentPlan(
      [
        // newest first, as the repository returns them
        log({ type: 'Worming', date: '2026-05-20', nextDueDate: '2026-08-20' }),
        log({ type: 'Vaccination', date: '2026-05-10', nextDueDate: '2026-06-08' }),
        log({ type: 'Worming', date: '2026-02-20', nextDueDate: '2026-05-20' }),
        log({ type: 'Tick check', date: '2026-05-05' }),
      ],
      '2026-06-01',
    );
    expect(plan).toEqual([
      expect.objectContaining({ type: 'Vaccination', nextDueDate: '2026-06-08', days: 7 }),
      expect.objectContaining({ type: 'Worming', nextDueDate: '2026-08-20', days: 80 }),
    ]);
  });

  it('a newer entry of the same type without a due date clears the reminder', () => {
    const plan = currentPlan(
      [
        log({ type: 'Worming', date: '2026-05-20' }),
        log({ type: 'Worming', date: '2026-02-20', nextDueDate: '2026-05-20' }),
      ],
      '2026-06-01',
    );
    expect(plan).toEqual([]);
  });

  it.each([
    [8, false],
    [7, true],
    [6, false],
    [1, false],
    [0, true],
    [-1, false],
    [-3, true],
    [-4, false],
  ])('reminds %i days from the due date: %s', (days, expected) => {
    const due = new Date(Date.UTC(2026, 5, 1 + days)).toISOString().slice(0, 10);
    const plan = currentPlan([log({ date: '2026-05-01', nextDueDate: due })], '2026-06-01');
    expect(remindersDue(plan).length > 0).toBe(expected);
  });
});

/** One owner with one dog, a log, and a clock for the job. */
async function setUp(opts: { reminders: boolean; due: string; type?: string }) {
  const state = { now: new Date('2026-06-01T05:30:00Z') }; // 06:30 UK
  const t = buildTestApp({ now: () => state.now });
  const gql = await t.signedIn('ann@example.com');
  const pet = await gql<{ createAnimal: { id: string } }>(
    `mutation { createAnimal(name: "Bella", species: "dog", category: PET) { id } }`,
  );
  const id = pet.data!.createAnimal.id;
  if (opts.reminders) {
    const res = await gql<{ updateAnimal: { remindersEnabled: boolean } }>(
      `mutation ($id: ID!) { updateAnimal(id: $id, input: { remindersEnabled: true }) { remindersEnabled } }`,
      { id },
    );
    expect(res.data?.updateAnimal.remindersEnabled).toBe(true);
  }
  await gql(
    `mutation ($id: ID!, $due: String!, $type: String!) {
      addLogEntry(animalId: $id, date: "2026-03-01", type: $type, nextDueDate: $due) { id }
    }`,
    { id, due: opts.due, type: opts.type ?? 'Vaccination' },
  );
  return { t, state, gql, id };
}

describe('pet reminder emails', () => {
  it('are off until the owner turns them on', async () => {
    const { t, state } = await setUp({ reminders: false, due: '2026-06-08' });
    state.now = new Date('2026-06-01T07:00:00Z');
    expect(await t.petJob.runOnce()).toMatchObject({ sent: 0 });
    expect(t.email.sent).toHaveLength(0);
  });

  it('wait until 07:00 UK, then email once a day', async () => {
    const { t, state } = await setUp({ reminders: true, due: '2026-06-08' });
    await t.petJob.runOnce(); // 06:30
    expect(t.email.sent).toHaveLength(0);

    state.now = new Date('2026-06-01T06:00:00Z'); // 07:00 UK
    expect(await t.petJob.runOnce()).toMatchObject({ sent: 1 });
    expect(t.email.sent[0]).toMatchObject({
      to: 'ann@example.com',
      subject: 'Bella: Vaccination due in 7 days',
    });
    expect(t.email.sent[0]!.text).toContain('Vaccination: due in 7 days (Mon 8 Jun)');
    expect(t.email.sent[0]!.text).toContain('https://bellwether.test/pets/');
    expect(t.email.sent[0]!.text).toContain('not veterinary advice');

    state.now = new Date('2026-06-01T09:00:00Z');
    await t.petJob.runOnce();
    expect(t.email.sent).toHaveLength(1);
  });

  it('say nothing on days between reminders', async () => {
    const { t, state } = await setUp({ reminders: true, due: '2026-06-05' });
    state.now = new Date('2026-06-01T07:00:00Z');
    await t.petJob.runOnce();
    expect(t.email.sent).toHaveLength(0);
  });

  it('remind on the day and when 3 days late, and stop once a newer entry is logged', async () => {
    const { t, state, gql, id } = await setUp({ reminders: true, due: '2026-06-01' });
    state.now = new Date('2026-06-01T07:00:00Z');
    await t.petJob.runOnce();
    expect(t.email.sent[0]!.subject).toBe('Bella: Vaccination due today');

    state.now = new Date('2026-06-04T07:00:00Z');
    await t.petJob.runOnce();
    expect(t.email.sent[1]!.subject).toBe('Bella: Vaccination overdue by 3 days');

    await gql(
      `mutation ($id: ID!) { addLogEntry(animalId: $id, date: "2026-06-04", type: "Vaccination") { id } }`,
      { id },
    );
    state.now = new Date('2026-06-04T09:00:00Z');
    expect(await t.petJob.runOnce()).toMatchObject({ sent: 0 });
  });

  it('group several pets and items into one email per owner', async () => {
    const { t, state, gql } = await setUp({ reminders: true, due: '2026-06-08' });
    const cat = await gql<{ createAnimal: { id: string } }>(
      `mutation { createAnimal(name: "Tom", species: "cat", category: PET) { id } }`,
    );
    const catId = cat.data!.createAnimal.id;
    await gql(
      `mutation ($id: ID!) {
        updateAnimal(id: $id, input: { remindersEnabled: true }) { id }
        addLogEntry(animalId: $id, date: "2026-03-01", type: "Worming", nextDueDate: "2026-06-01") { id }
      }`,
      { id: catId },
    );
    state.now = new Date('2026-06-01T07:00:00Z');
    await t.petJob.runOnce();
    expect(t.email.sent).toHaveLength(1);
    expect(t.email.sent[0]!.subject).toBe('Pet reminders: 2 due');
    expect(t.email.sent[0]!.text).toContain('Bella');
    expect(t.email.sent[0]!.text).toContain('Tom');
    expect(t.email.sent[0]!.html).toContain('Worming: due today');
  });

  it('escape what the owner typed in the HTML version', async () => {
    const { t, state } = await setUp({
      reminders: true,
      due: '2026-06-08',
      type: '<b>Booster</b>',
    });
    state.now = new Date('2026-06-01T07:00:00Z');
    await t.petJob.runOnce();
    expect(t.email.sent[0]!.html).toContain('&lt;b&gt;Booster&lt;/b&gt;');
    expect(t.email.sent[0]!.html).not.toContain('<b>Booster');
  });
});

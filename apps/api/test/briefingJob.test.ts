import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache/cache';
import type { WeatherClient } from '../src/clients/weatherClient';
import { buildTestApp, fakeDays } from './fakes';

/** A farm with one group, an owner, and a job driven by a fixed clock. */
async function setUp(group: string, prefs?: Record<string, unknown>) {
  const state = { now: new Date('2026-06-01T04:30:00Z'), weatherDown: false }; // 05:30 UK
  const weather: WeatherClient = {
    async getDailyForecast() {
      if (state.weatherDown) throw new Error('Open-Meteo responded 503');
      return fakeDays();
    },
    getHistory: async () => [],
  };
  const t = buildTestApp({
    weather,
    now: () => state.now,
    cache: new MemoryCache(() => state.now.getTime()),
  });
  const gql = await t.signedIn('ann@example.com');
  const farm = await gql<{ createFarm: { id: string } }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  await gql(
    `mutation ($farmId: ID!) { createLivestockGroup(input: { farmId: $farmId, ${group} }) { id } }`,
    {
      farmId,
    },
  );
  if (prefs) {
    await gql(
      `mutation ($farmId: ID!, $input: BriefingPreferencesInput!) {
        setBriefingPreferences(farmId: $farmId, input: $input) { sendAt }
      }`,
      { farmId, input: { emailEnabled: true, sendAt: '06:00', alwaysSend: false, ...prefs } },
    );
  }
  return { t, state, farmId };
}

const FLAGGED = 'name: "Ewes", species: SHEEP, livestockClass: EWES, headCount: 100';
const QUIET = 'name: "Beef", species: CATTLE, livestockClass: BEEF_CATTLE, headCount: 30';

describe('daily briefing job (FR-4.3, FR-4.5)', () => {
  it('generates and stores the day’s briefing before anyone asks for it', async () => {
    const { t, farmId } = await setUp(FLAGGED);
    await t.job.runOnce();
    const stored = await t.briefings.getRun(farmId, '2026-06-01');
    expect(stored).toMatchObject({ date: '2026-06-01', flaggedCount: 1 });
  });

  it('waits for the chosen time, then emails once', async () => {
    const { t, state } = await setUp(FLAGGED);
    await t.job.runOnce(); // 05:30
    expect(t.email.sent).toHaveLength(0);

    state.now = new Date('2026-06-01T05:00:00Z'); // 06:00 UK
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(1);
    expect(t.email.sent[0]).toMatchObject({
      to: 'ann@example.com',
      subject: 'Hill Farm briefing, Mon 1 Jun: 1 High',
    });
    expect(t.email.sent[0]!.text).toContain('Sheep blowfly strike');

    state.now = new Date('2026-06-01T05:10:00Z');
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(1);
  });

  it('uses the user’s chosen time', async () => {
    const { t, state } = await setUp(FLAGGED, { sendAt: '07:30' });
    state.now = new Date('2026-06-01T06:29:00Z'); // 07:29 UK
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(0);
    state.now = new Date('2026-06-01T06:30:00Z'); // 07:30 UK
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(1);
  });

  it('skips the email when nothing is flagged', async () => {
    const { t, state } = await setUp(QUIET);
    state.now = new Date('2026-06-01T05:00:00Z');
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(0);
  });

  it('sends a quiet-day email when "always send" is on', async () => {
    const { t, state } = await setUp(QUIET, { alwaysSend: true });
    state.now = new Date('2026-06-01T05:00:00Z');
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(1);
    expect(t.email.sent[0]!.subject).toMatch(/no concerns this week/);
  });

  it('sends nothing when email is turned off', async () => {
    const { t, state } = await setUp(FLAGGED, { emailEnabled: false });
    state.now = new Date('2026-06-01T05:00:00Z');
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(0);
  });

  it('keeps going when the weather is down, and emails once it is back', async () => {
    const { t, state, farmId } = await setUp(FLAGGED);
    state.now = new Date('2026-06-01T05:00:00Z');
    state.weatherDown = true;
    await expect(t.job.runOnce()).resolves.toBeDefined();
    expect(t.email.sent).toHaveLength(0);
    expect(await t.briefings.getRun(farmId, '2026-06-01')).toBeNull();

    state.weatherDown = false;
    await t.job.runOnce();
    expect(t.email.sent).toHaveLength(1);
  });
});

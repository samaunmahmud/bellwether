import type { DailyWeather } from '@bellwether/risk-engine';
import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/cache/cache';
import type { WeatherClient } from '../src/clients/weatherClient';
import { buildTestApp, fakeDays, type Gql } from './fakes';

const BRIEFING = /* GraphQL */ `
  query ($farmId: ID!) {
    briefing(farmId: $farmId) {
      date
      generatedAt
      isStale
      overdueTasks {
        title
        dueDate
      }
      groups {
        groupId
        groupName
        fieldName
        items {
          riskId
          riskName
          level
          daysAffected {
            date
            level
          }
          reason
          checks
          isNew
        }
      }
      quietGroups {
        groupName
      }
    }
  }
`;

type Briefing = {
  date: string;
  generatedAt: string;
  isStale: boolean;
  overdueTasks: Array<{ title: string; dueDate: string }>;
  groups: Array<{
    groupId: string;
    groupName: string;
    fieldName: string | null;
    items: Array<{
      riskId: string;
      riskName: string;
      level: string;
      daysAffected: Array<{ date: string; level: string }>;
      reason: string;
      checks: string[];
      isNew: boolean;
    }>;
  }>;
  quietGroups: Array<{ groupName: string }>;
};

/** 14 days of weather starting on `start`. */
function weatherFrom(start: string, overrides: Partial<DailyWeather> = {}): DailyWeather[] {
  return fakeDays(14, overrides).map((d, i) => {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    return { ...d, date: date.toISOString().slice(0, 10) };
  });
}

/** An app whose clock and weather can be changed between requests. */
async function farmWithClock() {
  const state = {
    now: new Date('2026-06-01T05:00:00Z'), // 06:00 in the UK
    weather: weatherFrom('2026-06-01'),
    weatherDown: false,
  };
  const weather: WeatherClient = {
    async getDailyForecast() {
      if (state.weatherDown) throw new Error('Open-Meteo responded 503');
      return state.weather;
    },
    getHistory: async () => [],
  };
  const t = buildTestApp({
    weather,
    now: () => state.now,
    cache: new MemoryCache(() => state.now.getTime()),
  });
  const gql = await t.signedIn();
  const farm = await gql<{ createFarm: { id: string } }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  return { t, gql, farmId, state };
}

async function addGroup(gql: Gql, farmId: string, input: string) {
  const res = await gql<{ createLivestockGroup: { id: string } }>(
    `mutation ($farmId: ID!) { createLivestockGroup(input: { farmId: $farmId, ${input} }) { id } }`,
    { farmId },
  );
  expect(res.errors).toBeUndefined();
  return res.data!.createLivestockGroup.id;
}

async function briefing(gql: Gql, farmId: string): Promise<Briefing> {
  const res = await gql<{ briefing: Briefing }>(BRIEFING, { farmId });
  expect(res.errors).toBeUndefined();
  return res.data!.briefing;
}

const UNSHORN_EWES = 'name: "Ewes", species: SHEEP, livestockClass: EWES, headCount: 100';
const BEEF = 'name: "Beef", species: CATTLE, livestockClass: BEEF_CATTLE, headCount: 30';

describe('farm morning briefing (FR-4.1, FR-4.2)', () => {
  it('flags each group’s Medium and High risks for the next 7 days, with checks', async () => {
    const { gql, farmId } = await farmWithClock();
    await addGroup(gql, farmId, UNSHORN_EWES);
    await addGroup(gql, farmId, BEEF);

    const b = await briefing(gql, farmId);
    expect(b.date).toBe('2026-06-01');
    expect(b.isStale).toBe(false);
    expect(b.groups).toHaveLength(1);
    const [ewes] = b.groups;
    expect(ewes!.groupName).toBe('Ewes');
    const blowfly = ewes!.items.find((i) => i.riskId === 'sheep-blowfly')!;
    expect(blowfly).toMatchObject({ riskName: 'Sheep blowfly strike', level: 'HIGH' });
    expect(blowfly.daysAffected).toHaveLength(7);
    expect(blowfly.reason).toMatch(/no shearing date is recorded/);
    expect(blowfly.checks).toContain('Check the flock daily for signs of strike');
    // Mild weather: no heat stress for the beef cattle
    expect(b.quietGroups).toEqual([{ groupName: 'Beef' }]);
  });

  it('shows "Housed" in place of a field for housed groups', async () => {
    const { gql, farmId } = await farmWithClock();
    await addGroup(gql, farmId, `${UNSHORN_EWES}, housed: true`);
    expect((await briefing(gql, farmId)).groups[0]!.fieldName).toBe('Housed');
  });
});

describe('stored briefing runs (FR-4.5)', () => {
  it('serves the stored run for the rest of the day', async () => {
    const { gql, farmId, state } = await farmWithClock();
    await addGroup(gql, farmId, UNSHORN_EWES);
    const first = await briefing(gql, farmId);

    state.now = new Date('2026-06-01T15:00:00Z');
    expect((await briefing(gql, farmId)).generatedAt).toBe(first.generatedAt);
  });

  it('regenerates on request', async () => {
    const { gql, farmId, state } = await farmWithClock();
    await addGroup(gql, farmId, UNSHORN_EWES);
    await briefing(gql, farmId);

    state.now = new Date('2026-06-01T15:00:00Z');
    const res = await gql<{ refreshBriefing: { generatedAt: string } }>(
      `mutation ($farmId: ID!) { refreshBriefing(farmId: $farmId) { generatedAt } }`,
      { farmId },
    );
    expect(res.data!.refreshBriefing.generatedAt).toBe('2026-06-01T15:00:00.000Z');
  });

  it('shows the last successful briefing, marked stale, if the weather can’t be fetched', async () => {
    const { gql, farmId, state } = await farmWithClock();
    await addGroup(gql, farmId, UNSHORN_EWES);
    const yesterday = await briefing(gql, farmId);

    state.now = new Date('2026-06-02T05:00:00Z');
    state.weatherDown = true;
    const today = await briefing(gql, farmId);
    expect(today).toMatchObject({ date: '2026-06-01', isStale: true });
    expect(today.generatedAt).toBe(yesterday.generatedAt);
  });

  it('reports the outage if there is no earlier briefing to show', async () => {
    const { gql, farmId, state } = await farmWithClock();
    await addGroup(gql, farmId, UNSHORN_EWES);
    state.weatherDown = true;
    const res = await gql(BRIEFING, { farmId });
    expect(res.errors?.[0]?.extensions?.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});

describe('"New" Highs across days (FR-4.4 acceptance)', () => {
  it('marks Medium → High as New, and High → High as not New', async () => {
    const { gql, farmId, state } = await farmWithClock();
    // Shorn recently, so only the weather drives blowfly risk
    await addGroup(gql, farmId, `${UNSHORN_EWES}, lastShearingDate: "2026-05-30"`);

    // Day 1: mild and dry → Medium
    state.weather = weatherFrom('2026-06-01', { humidityMeanPct: 50 });
    const day1 = await briefing(gql, farmId);
    expect(day1.groups[0]!.items[0]).toMatchObject({ level: 'MEDIUM', isNew: false });

    // Day 2: warm and humid → High, and it wasn't High yesterday
    state.now = new Date('2026-06-02T05:00:00Z');
    state.weather = weatherFrom('2026-06-02', { tempMeanC: 16, humidityMeanPct: 80 });
    const day2 = await briefing(gql, farmId);
    expect(day2.groups[0]!.items[0]).toMatchObject({ level: 'HIGH', isNew: true });

    // Day 3: still High → not New
    state.now = new Date('2026-06-03T05:00:00Z');
    state.weather = weatherFrom('2026-06-03', { tempMeanC: 16, humidityMeanPct: 80 });
    const day3 = await briefing(gql, farmId);
    expect(day3.groups[0]!.items[0]).toMatchObject({ level: 'HIGH', isNew: false });
  });
});

describe('tasks (FR-5.2, FR-5.5)', () => {
  const CREATE_TASK = /* GraphQL */ `
    mutation ($input: CreateTaskInput!) {
      createTask(input: $input) {
        id
        title
        dueDate
        done
        overdue
      }
    }
  `;

  it('turns a suggested check into a task in one call', async () => {
    const { gql, farmId } = await farmWithClock();
    const groupId = await addGroup(gql, farmId, UNSHORN_EWES);
    const item = (await briefing(gql, farmId)).groups[0]!.items[0]!;

    const res = await gql<{ createTask: { title: string; dueDate: string; done: boolean } }>(
      CREATE_TASK,
      { input: { groupId, title: item.checks[0], dueDate: item.daysAffected[0]!.date } },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.createTask).toMatchObject({
      title: item.checks[0],
      dueDate: '2026-06-01',
      done: false,
    });

    const list = await gql<{ tasks: Array<{ title: string; group: { name: string } }> }>(
      `query ($farmId: ID!) { tasks(farmId: $farmId) { title group { name } } }`,
      { farmId },
    );
    expect(list.data!.tasks).toEqual([{ title: item.checks[0], group: { name: 'Ewes' } }]);
  });

  it('puts overdue tasks at the top of the briefing until they are done', async () => {
    const { gql, farmId } = await farmWithClock();
    const groupId = await addGroup(gql, farmId, UNSHORN_EWES);
    const late = await gql<{ createTask: { id: string; overdue: boolean } }>(CREATE_TASK, {
      input: { groupId, title: 'Check water troughs', dueDate: '2026-05-31' },
    });
    await gql(CREATE_TASK, { input: { groupId, title: 'Due today', dueDate: '2026-06-01' } });
    expect(late.data!.createTask.overdue).toBe(true);

    expect((await briefing(gql, farmId)).overdueTasks).toEqual([
      { title: 'Check water troughs', dueDate: '2026-05-31' },
    ]);

    await gql(`mutation ($id: ID!) { setTaskDone(id: $id, done: true) { done } }`, {
      id: late.data!.createTask.id,
    });
    expect((await briefing(gql, farmId)).overdueTasks).toEqual([]);
  });
});

describe('briefing email preferences (FR-4.3)', () => {
  const PREFS = /* GraphQL */ `
    query ($farmId: ID!) {
      briefingPreferences(farmId: $farmId) {
        emailEnabled
        sendAt
        alwaysSend
      }
    }
  `;
  const SET_PREFS = /* GraphQL */ `
    mutation ($farmId: ID!, $input: BriefingPreferencesInput!) {
      setBriefingPreferences(farmId: $farmId, input: $input) {
        emailEnabled
        sendAt
        alwaysSend
      }
    }
  `;

  it('defaults to 06:00 UK time, skipping quiet days', async () => {
    const { gql, farmId } = await farmWithClock();
    expect((await gql(PREFS, { farmId })).data).toEqual({
      briefingPreferences: { emailEnabled: true, sendAt: '06:00', alwaysSend: false },
    });
  });

  it('saves a new time and "always send"', async () => {
    const { gql, farmId } = await farmWithClock();
    const input = { emailEnabled: true, sendAt: '07:15', alwaysSend: true };
    expect((await gql(SET_PREFS, { farmId, input })).data).toEqual({
      setBriefingPreferences: input,
    });
    expect((await gql(PREFS, { farmId })).data).toEqual({ briefingPreferences: input });
  });

  it.each(['24:00', '6:00', '06:60', 'six'])('rejects the time %s', async (sendAt) => {
    const { gql, farmId } = await farmWithClock();
    const res = await gql(SET_PREFS, {
      farmId,
      input: { emailEnabled: true, sendAt, alwaysSend: false },
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
  });
});

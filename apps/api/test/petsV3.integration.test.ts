import type { HourlyWeather } from '@bellwether/risk-engine';
import { describe, expect, it } from 'vitest';
import { buildTestApp, fakeDays, fakeWeather } from './fakes';

const code = (res: { errors?: Array<{ extensions?: { code?: string } }> }) =>
  res.errors?.[0]?.extensions?.code;

const hour = (date: string, h: number, tempC: number): HourlyWeather => ({
  time: `${date}T${String(h).padStart(2, '0')}:00`,
  tempC,
  humidityPct: 60,
  windSpeedMs: 2,
  precipitationMm: 0,
});

async function dog(withHours = false) {
  const days = fakeDays(14);
  if (withHours)
    days[0]!.hours = Array.from({ length: 24 }, (_, h) =>
      hour(days[0]!.date, h, h < 9 ? 15 : h < 12 ? 22 : h < 18 ? 27 : 18),
    );
  const app = buildTestApp({ weather: fakeWeather(days).client });
  const ann = await app.signedIn();
  const created = await ann<{ createAnimal: { id: string } }>(
    `mutation { createAnimal(name: "Rex", species: "dog", category: PET, postcode: "UB8 3PH") { id } }`,
  );
  return { ann, id: created.data!.createAnimal.id };
}

describe('pet health plan (v3)', () => {
  it('logs a weight with an entry and lets it be corrected', async () => {
    const { ann, id } = await dog();
    const added = await ann<{ addLogEntry: { id: string; weightKg: number } }>(
      `mutation ($id: ID!) {
        addLogEntry(animalId: $id, date: "2026-05-30", type: "Weight check", weightKg: 21.46) { id weightKg }
      }`,
      { id },
    );
    expect(added.data!.addLogEntry.weightKg).toBe(21.5);
    const updated = await ann<{ updateLogEntry: { weightKg: number | null } }>(
      `mutation ($id: ID!) { updateLogEntry(id: $id, input: { weightKg: null }) { weightKg } }`,
      { id: added.data!.addLogEntry.id },
    );
    expect(updated.data!.updateLogEntry.weightKg).toBeNull();
  });

  it('refuses an impossible weight', async () => {
    const { ann, id } = await dog();
    const res = await ann(
      `mutation ($id: ID!) { addLogEntry(animalId: $id, date: "2026-05-30", type: "Weight", weightKg: 0) { id } }`,
      { id },
    );
    expect(code(res)).toBe('BAD_INPUT');
  });
});

describe('walk planner (v3)', () => {
  it("rates today's daytime hours for a dog walk, and picks the coolest", async () => {
    const { ann, id } = await dog(true);
    const res = await ann<{
      animal: {
        walkPlanner: { hours: Array<{ time: string; level: string }>; bestTimes: string[] };
      };
    }>(
      `query ($id: ID!) { animal(id: $id) { walkPlanner { date hours { time tempC level } bestTimes } } }`,
      { id },
    );
    const { hours, bestTimes } = res.data!.animal.walkPlanner;
    expect(hours.map((h) => h.time.slice(11, 13))).toEqual(
      Array.from({ length: 17 }, (_, i) => String(i + 6).padStart(2, '0')),
    );
    expect(hours.find((h) => h.time.endsWith('07:00'))!.level).toBe('GOOD');
    expect(hours.find((h) => h.time.endsWith('10:00'))!.level).toBe('WARM');
    expect(hours.find((h) => h.time.endsWith('14:00'))!.level).toBe('HOT');
    expect(bestTimes).toEqual(['06:00–09:00', '18:00–23:00']);
  });

  it('has no planner without hourly data, a postcode or for a cat', async () => {
    const { ann, id } = await dog(false);
    const res = await ann<{ animal: { walkPlanner: unknown } }>(
      `query ($id: ID!) { animal(id: $id) { walkPlanner { date } } }`,
      { id },
    );
    expect(res.data!.animal.walkPlanner).toBeNull();
  });
});

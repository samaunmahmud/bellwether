import { describe, expect, it } from 'vitest';
import { buildTestApp } from './fakes';

const START = `mutation { startDemo(postcode: "UB8 3PH") { id email } }`;

interface Explored {
  me: { email: string };
  farms: Array<{
    id: string;
    name: string;
    myRole: string;
    groups: Array<{ species: string }>;
    members: Array<{ email: string; role: string; isMe: boolean }>;
  }>;
  animals: Array<{
    name: string;
    species: string;
    remindersEnabled: boolean;
    logs: Array<{ type: string; weightKg: number | null }>;
  }>;
}

const EXPLORE = `{
  me { email }
  farms { id name myRole groups { species } members { email role isMe } }
  animals { name species remindersEnabled breed dateOfBirth logs { type weightKg } }
}`;

/** Signs in with the session cookie returned by startDemo. */
async function startDemo(t: ReturnType<typeof buildTestApp>) {
  const { body, response } = await t.send<{ startDemo: { id: string; email: string } }>(START);
  expect(body.errors?.[0]?.message).toBeUndefined();
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]!;
  expect(cookie).toMatch(/=/);
  return { user: body.data!.startDemo, gql: t.withCookie(cookie) };
}

describe('one-click demo account (v3.2)', () => {
  it('signs a visitor straight into a new account full of example data', async () => {
    const t = buildTestApp();
    const { user, gql } = await startDemo(t);
    expect(user.email).toMatch(/^demo-[0-9a-f]{8}@example\.com$/);

    const res = await gql<Explored>(EXPLORE);
    expect(res.errors?.[0]?.message).toBeUndefined();
    const { me, farms, animals } = res.data!;
    expect(me.email).toBe(user.email);

    // A hill farm with sheep and cattle, and a dairy farm
    expect(farms.map((f) => f.name).sort()).toEqual([
      'Brookside Dairy (demo)',
      'Fellside Farm (demo)',
    ]);
    expect(farms.every((f) => f.myRole === 'OWNER')).toBe(true);
    const dairy = farms.find((f) => f.name.startsWith('Brookside'))!;
    expect(dairy.groups.length).toBeGreaterThanOrEqual(3);
    expect(dairy.groups.every((g) => g.species === 'CATTLE')).toBe(true);

    // A team to show sharing and assignment
    const fellside = farms.find((f) => f.name.startsWith('Fellside'))!;
    expect(fellside.members.map((m) => m.role).sort()).toEqual(['OWNER', 'VIEWER', 'WORKER']);

    // Pets with a history, reminders on
    expect(animals.map((a) => `${a.name}:${a.species}`).sort()).toEqual(['Bess:dog', 'Tom:cat']);
    const bess = animals.find((a) => a.name === 'Bess')!;
    expect(bess.remindersEnabled).toBe(true);
    expect(bess).toMatchObject({ breed: 'Border collie', dateOfBirth: expect.any(String) });

    // Tagged cows with ages in the dairy's milking herd (v4)
    const cows = await gql<{
      taggedAnimals: Array<{ ageMonths: number; group: { name: string } }>;
    }>(`query ($id: ID!) { taggedAnimals(farmId: $id) { ageMonths group { name } } }`, {
      id: dairy.id,
    });
    expect(cows.data!.taggedAnimals.length).toBeGreaterThanOrEqual(5);
    expect(cows.data!.taggedAnimals.every((c) => c.ageMonths >= 24)).toBe(true);
    expect(new Set(cows.data!.taggedAnimals.map((c) => c.group.name))).toEqual(
      new Set(['Milking herd']),
    );
    expect(bess.logs.filter((l) => l.weightKg !== null).length).toBeGreaterThanOrEqual(4);

    // Vets to call in an emergency, from the farms and the pets' own contacts
    const vets = await gql<{ emergencyContacts: Array<{ emergencyPhone: string | null }> }>(
      `query { emergencyContacts { emergencyPhone } }`,
    );
    // The farm vet (saved on both farms) once, and the pets' clinic
    expect(vets.data!.emergencyContacts).toHaveLength(2);
    expect(vets.data!.emergencyContacts[0]!.emergencyPhone).toMatch(/^01632 960/);
  });

  it('gives tasks to the worker', async () => {
    const t = buildTestApp();
    const { gql } = await startDemo(t);
    const farms = (await gql<Explored>(EXPLORE)).data!.farms;
    const fellside = farms.find((f) => f.name.startsWith('Fellside'))!;
    const worker = fellside.members.find((m) => m.role === 'WORKER')!;
    const res = await gql<{ tasks: Array<{ assignee: { email: string } | null }> }>(
      `query ($id: ID!) { tasks(farmId: $id) { assignee { email } } }`,
      { id: fellside.id },
    );
    expect(res.errors?.[0]?.message).toBeUndefined();
    expect(
      res.data!.tasks.filter((x) => x.assignee?.email === worker.email).length,
    ).toBeGreaterThan(0);
  });

  it('makes a separate account each time, so visitors never see each other’s changes', async () => {
    const t = buildTestApp();
    const a = await startDemo(t);
    const b = await startDemo(t);
    expect(a.user.id).not.toBe(b.user.id);
    const aFarms = (await a.gql<Explored>(EXPLORE)).data!.farms.map((f) => f.id);
    const bFarms = (await b.gql<Explored>(EXPLORE)).data!.farms.map((f) => f.id);
    expect(aFarms.some((id) => bFarms.includes(id))).toBe(false);
  });

  it('can be turned off', async () => {
    const t = buildTestApp({ demoAccounts: false });
    const res = await t.gql(START);
    expect(res.errors?.[0]?.message).toMatch(/demo accounts are turned off/i);
  });
});

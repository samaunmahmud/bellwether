import { describe, expect, it } from 'vitest';
import { monthsBetween } from '../src/services/keepingService';
import { buildTestApp, type Gql } from './fakes';

describe('monthsBetween', () => {
  it.each([
    ['2026-01-15', '2026-06-01', 4],
    ['2026-01-01', '2026-06-01', 5],
    ['2025-06-01', '2026-06-01', 12],
    ['2026-05-31', '2026-06-01', 0],
  ])('%s to %s is %i months', (from, to, months) => {
    expect(monthsBetween(from, to)).toBe(months);
  });
});

const ADD = `mutation ($input: TaggedAnimalInput!) {
  addTaggedAnimal(input: $input) { id tag name species sex breed dateOfBirth status group { name } }
}`;

async function farmAndGroup(gql: Gql) {
  const farm = await gql<{ createFarm: { id: string } }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const group = await gql<{ createLivestockGroup: { id: string } }>(
    `mutation ($farmId: ID!) { createLivestockGroup(input: { farmId: $farmId, name: "Cows", species: CATTLE, livestockClass: BEEF_CATTLE, headCount: 10 }) { id } }`,
    { farmId },
  );
  return { farmId, groupId: group.data!.createLivestockGroup.id };
}

describe('individual animals with ages (v4)', () => {
  it('records a tagged animal with its date of birth, breed and group', async () => {
    const t = buildTestApp(); // today is 2026-06-01
    const ann = await t.signedIn();
    const { farmId, groupId } = await farmAndGroup(ann);
    const res = await ann<{ addTaggedAnimal: Record<string, unknown> }>(ADD, {
      input: {
        farmId,
        groupId,
        tag: ' uk 123456 700001 ',
        name: 'Daisy',
        species: 'CATTLE',
        sex: 'FEMALE',
        breed: 'Hereford',
        dateOfBirth: '2022-03-14',
      },
    });
    expect(res.errors?.[0]?.message).toBeUndefined();
    expect(res.data!.addTaggedAnimal).toMatchObject({
      tag: 'UK 123456 700001',
      name: 'Daisy',
      status: 'ON_FARM',
      dateOfBirth: '2022-03-14',
      group: { name: 'Cows' },
    });
    const list = await ann<{ taggedAnimals: Array<{ tag: string }> }>(
      `query ($farmId: ID!) { taggedAnimals(farmId: $farmId) { tag } }`,
      { farmId },
    );
    expect(list.data!.taggedAnimals).toEqual([{ tag: 'UK 123456 700001' }]);
  });

  it.each([
    [{ tag: '  ' }, /tag/i],
    [{ dateOfBirth: '2026-06-02' }, /future/i],
    [{ dateOfBirth: '1900-01-01' }, /date of birth/i],
    [{ species: 'SHEEP' }, /group.*cattle|species/i],
  ])('refuses %j', async (fields, message) => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId, groupId } = await farmAndGroup(ann);
    const res = await ann(ADD, {
      input: { farmId, groupId, tag: 'A1', species: 'CATTLE', sex: 'FEMALE', ...fields },
    });
    expect(res.errors?.[0]?.message).toMatch(message);
  });

  it('keeps each tag unique on a farm, ignoring case and spaces', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId } = await farmAndGroup(ann);
    await ann(ADD, { input: { farmId, tag: 'UK 1', species: 'SHEEP', sex: 'FEMALE' } });
    const res = await ann(ADD, {
      input: { farmId, tag: 'uk  1', species: 'SHEEP', sex: 'FEMALE' },
    });
    expect(res.errors?.[0]?.message).toMatch(/already/i);
  });

  it('marks an animal sold or died with a date, and edits and deletes it', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId } = await farmAndGroup(ann);
    const added = await ann<{ addTaggedAnimal: { id: string } }>(ADD, {
      input: { farmId, tag: 'UK 2', species: 'SHEEP', sex: 'MALE' },
    });
    const id = added.data!.addTaggedAnimal.id;
    const sold = await ann<{ updateTaggedAnimal: Record<string, unknown> }>(
      `mutation ($id: ID!) { updateTaggedAnimal(id: $id, input: { status: SOLD, statusDate: "2026-05-20", breed: "Texel" }) { status statusDate breed tag } }`,
      { id },
    );
    expect(sold.data!.updateTaggedAnimal).toEqual({
      status: 'SOLD',
      statusDate: '2026-05-20',
      breed: 'Texel',
      tag: 'UK 2',
    });
    const noDate = await ann(
      `mutation ($id: ID!) { updateTaggedAnimal(id: $id, input: { status: DIED, statusDate: null }) { id } }`,
      { id },
    );
    expect(noDate.errors?.[0]?.message).toMatch(/date/i);
    expect((await ann(`mutation ($id: ID!) { deleteTaggedAnimal(id: $id) }`, { id })).data).toEqual(
      { deleteTaggedAnimal: true },
    );
  });

  it('lets workers record animals but not viewers', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn('ann@example.com');
    const vic = await t.signedIn('vic@example.com');
    const { farmId } = await farmAndGroup(ann);
    await ann(
      `mutation ($id: ID!) { inviteMember(farmId: $id, email: "vic@example.com", role: VIEWER) { id } }`,
      { id: farmId },
    );
    const invites = await vic<{ myInvites: Array<{ id: string }> }>(`query { myInvites { id } }`);
    await vic(`mutation ($id: ID!) { acceptInvite(id: $id) { id } }`, {
      id: invites.data!.myInvites[0]!.id,
    });
    const res = await vic(ADD, { input: { farmId, tag: 'X', species: 'SHEEP', sex: 'FEMALE' } });
    expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});

describe('tagged animals in groups (v4)', () => {
  it('shows age in months and lists a group’s animals still on the farm', async () => {
    const t = buildTestApp(); // today is 2026-06-01
    const ann = await t.signedIn();
    const { farmId, groupId } = await farmAndGroup(ann);
    const add = (tag: string) =>
      ann<{ addTaggedAnimal: { id: string; ageMonths: number | null } }>(
        `mutation ($input: TaggedAnimalInput!) { addTaggedAnimal(input: $input) { id ageMonths } }`,
        {
          input: {
            farmId,
            groupId,
            tag,
            species: 'CATTLE',
            sex: 'FEMALE',
            dateOfBirth: '2024-05-15',
          },
        },
      );
    const first = await add('UK 10');
    expect(first.data!.addTaggedAnimal.ageMonths).toBe(24);
    const sold = await add('UK 2');
    await ann(
      `mutation ($id: ID!) { updateTaggedAnimal(id: $id, input: { status: SOLD, statusDate: "2026-05-01" }) { id } }`,
      { id: sold.data!.addTaggedAnimal.id },
    );
    await add('UK 3');
    const group = await ann<{ livestockGroup: { taggedAnimals: Array<{ tag: string }> } }>(
      `query ($id: ID!) { livestockGroup(id: $id) { taggedAnimals { tag } } }`,
      { id: groupId },
    );
    expect(group.data!.livestockGroup.taggedAnimals.map((a) => a.tag)).toEqual(['UK 3', 'UK 10']);
  });

  it('refuses a sale date before birth, and a group on another farm', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId } = await farmAndGroup(ann);
    const other = await farmAndGroup(ann);
    const wrongFarm = await ann(ADD, {
      input: { farmId, groupId: other.groupId, tag: 'A', species: 'CATTLE', sex: 'MALE' },
    });
    expect(wrongFarm.errors?.[0]?.message).toMatch(/not found on this farm/);
    const added = await ann<{ addTaggedAnimal: { id: string } }>(ADD, {
      input: { farmId, tag: 'B', species: 'SHEEP', sex: 'MALE', dateOfBirth: '2026-03-01' },
    });
    const early = await ann(
      `mutation ($id: ID!) { updateTaggedAnimal(id: $id, input: { status: DIED, statusDate: "2026-02-01" }) { id } }`,
      { id: added.data!.addTaggedAnimal.id },
    );
    expect(early.errors?.[0]?.message).toMatch(/before its date of birth/);
    const back = await ann<{ updateTaggedAnimal: { status: string; statusDate: string | null } }>(
      `mutation ($id: ID!) { updateTaggedAnimal(id: $id, input: { status: ON_FARM, statusDate: "2026-04-01" }) { status statusDate } }`,
      { id: added.data!.addTaggedAnimal.id },
    );
    expect(back.data!.updateTaggedAnimal).toEqual({ status: 'ON_FARM', statusDate: null });
  });
});

describe('pet details (v4)', () => {
  it('keeps a pet’s date of birth, breed, sex and microchip number', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const pet = await ann<{ createAnimal: { id: string } }>(
      `mutation { createAnimal(name: "Bess", species: "dog", category: PET) { id } }`,
    );
    const res = await ann<{ updateAnimal: Record<string, unknown> }>(
      `mutation ($id: ID!) { updateAnimal(id: $id, input: { dateOfBirth: "2019-04-02", breed: "Border collie", sex: "Female (spayed)", microchip: "985 112 000 123 456" }) { dateOfBirth breed sex microchip } }`,
      { id: pet.data!.createAnimal.id },
    );
    expect(res.data!.updateAnimal).toEqual({
      dateOfBirth: '2019-04-02',
      breed: 'Border collie',
      sex: 'Female (spayed)',
      microchip: '985112000123456',
    });
    const bad = await ann(
      `mutation ($id: ID!) { updateAnimal(id: $id, input: { microchip: "12AB" }) { id } }`,
      { id: pet.data!.createAnimal.id },
    );
    expect(bad.errors?.[0]?.message).toMatch(/microchip/i);
  });
});

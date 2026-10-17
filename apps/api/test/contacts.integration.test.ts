import { describe, expect, it } from 'vitest';
import { buildTestApp, type Gql } from './fakes';

const ADD = `mutation ($input: ContactInput!) {
  addContact(input: $input) { id kind name phone emergencyPhone website farmName }
}`;

async function farmWith(gql: Gql) {
  const farm = await gql<{ createFarm: { id: string } }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  return farm.data!.createFarm.id;
}

describe('contacts and emergency numbers (v4)', () => {
  it('keeps a farm’s vet with an out-of-hours number and a tidy website link', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const farmId = await farmWith(ann);
    const res = await ann<{ addContact: Record<string, string> }>(ADD, {
      input: {
        farmId,
        kind: 'VET',
        name: ' Dale Vets ',
        phone: '01539 000000',
        emergencyPhone: '07700 900000',
        website: 'dalevets.example.com',
      },
    });
    expect(res.errors?.[0]?.message).toBeUndefined();
    expect(res.data!.addContact).toMatchObject({
      kind: 'VET',
      name: 'Dale Vets',
      website: 'https://dalevets.example.com',
      farmName: 'Hill Farm',
    });
    const list = await ann<{ contacts: Array<{ name: string }> }>(
      `query ($farmId: ID) { contacts(farmId: $farmId) { name } }`,
      { farmId },
    );
    expect(list.data!.contacts.map((c) => c.name)).toEqual(['Dale Vets']);
  });

  it.each([
    [{ name: '' }, /name/i],
    [{ name: 'Feed Co', phone: null, website: null, email: null }, /phone, email or website/i],
    [{ name: 'Feed Co', website: 'javascript:alert(1)' }, /web address/i],
    [{ name: 'Feed Co', email: 'not-an-email' }, /email/i],
    [{ name: 'Feed Co', phone: 'call me' }, /phone/i],
  ])('refuses %j', async (fields, message) => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const res = await ann(ADD, { input: { kind: 'FEED', phone: '01539 000000', ...fields } });
    expect(res.errors?.[0]?.message).toMatch(message);
  });

  it('keeps personal contacts (e.g. a pet’s vet) private to their owner', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn('ann@example.com');
    const bob = await t.signedIn('bob@example.com');
    await ann(ADD, { input: { kind: 'VET', name: 'Town Pet Vets', phone: '0100 000000' } });
    const mine = await ann<{ contacts: Array<{ name: string; farmName: string | null }> }>(
      `query { contacts { name farmName } }`,
    );
    expect(mine.data!.contacts).toEqual([{ name: 'Town Pet Vets', farmName: null }]);
    expect((await bob(`query { contacts { name } }`)).data).toEqual({ contacts: [] });
  });

  it('gathers every vet across my farms and my own contacts for an emergency, out-of-hours first', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const farmId = await farmWith(ann);
    await ann(ADD, { input: { farmId, kind: 'FEED', name: 'Feed Co', phone: '0100 111111' } });
    await ann(ADD, { input: { farmId, kind: 'VET', name: 'Day Vets', phone: '0100 222222' } });
    await ann(ADD, {
      input: {
        farmId,
        kind: 'VET',
        name: 'Night Vets',
        phone: '0100 333333',
        emergencyPhone: '0100 999999',
      },
    });
    await ann(ADD, { input: { kind: 'VET', name: 'Town Pet Vets', phone: '0100 444444' } });
    const res = await ann<{ emergencyContacts: Array<{ name: string }> }>(
      `query { emergencyContacts { name } }`,
    );
    expect(res.data!.emergencyContacts.map((c) => c.name)).toEqual([
      'Night Vets',
      'Day Vets',
      'Town Pet Vets',
    ]);
  });

  it('lets workers add farm contacts but not viewers, and edits and deletes them', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn('ann@example.com');
    const vic = await t.signedIn('vic@example.com');
    const farmId = await farmWith(ann);
    await ann(
      `mutation ($id: ID!) { inviteMember(farmId: $id, email: "vic@example.com", role: VIEWER) { id } }`,
      {
        id: farmId,
      },
    );
    const invites = await vic<{ myInvites: Array<{ id: string }> }>(`query { myInvites { id } }`);
    await vic(`mutation ($id: ID!) { acceptInvite(id: $id) { id } }`, {
      id: invites.data!.myInvites[0]!.id,
    });
    const refused = await vic(ADD, { input: { farmId, kind: 'FEED', name: 'X', phone: '0100' } });
    expect(refused.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

    const added = await ann<{ addContact: { id: string } }>(ADD, {
      input: { farmId, kind: 'SUPPLIER', name: 'Merchant', phone: '0100 555555' },
    });
    const id = added.data!.addContact.id;
    const updated = await ann<{ updateContact: { name: string; notes: string } }>(
      `mutation ($id: ID!) { updateContact(id: $id, input: { kind: SUPPLIER, name: "Merchant Ltd", phone: "0100 555555", notes: "Delivers Tuesdays" }) { name notes } }`,
      { id },
    );
    expect(updated.data!.updateContact).toEqual({
      name: 'Merchant Ltd',
      notes: 'Delivers Tuesdays',
    });
    expect((await ann(`mutation ($id: ID!) { deleteContact(id: $id) }`, { id })).data).toEqual({
      deleteContact: true,
    });
  });

  it('lists a vet saved on two farms once in an emergency', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const a = await farmWith(ann);
    const b = await farmWith(ann);
    for (const farmId of [a, b])
      await ann(ADD, { input: { farmId, kind: 'VET', name: 'Dale Vets', phone: '0100 222222' } });
    const res = await ann<{ emergencyContacts: unknown[] }>(`query { emergencyContacts { id } }`);
    expect(res.data!.emergencyContacts).toHaveLength(1);
  });
});

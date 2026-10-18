import { describe, expect, it } from 'vitest';
import { buildTestApp, type Gql } from './fakes';

type Id = { id: string };

const ADD = `mutation ($input: DocumentInput!) {
  addDocument(input: $input) {
    id kind title fileName mimeType sizeBytes documentDate expiresOn daysToExpiry
    farmName petName uploadedAt group { name } taggedAnimal { tag }
  }
}`;

const pdf = (text = 'hello') => Buffer.from(`%PDF-1.7\n${text}`).toString('base64');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString(
  'base64',
);

async function farmWithAnimal(gql: Gql) {
  const farm = await gql<{ createFarm: Id }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const group = await gql<{ createLivestockGroup: Id }>(
    `mutation ($farmId: ID!) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Ewes", species: SHEEP, livestockClass: EWES, headCount: 80
      }) { id }
    }`,
    { farmId },
  );
  const groupId = group.data!.createLivestockGroup.id;
  const tagged = await gql<{ addTaggedAnimal: Id }>(
    `mutation ($farmId: ID!, $groupId: ID!) {
      addTaggedAnimal(input: { farmId: $farmId, groupId: $groupId, tag: "UK 1", species: SHEEP, sex: FEMALE }) { id }
    }`,
    { farmId, groupId },
  );
  return { farmId, groupId, taggedId: tagged.data!.addTaggedAnimal.id };
}

async function petOf(gql: Gql) {
  const pet = await gql<{ createAnimal: Id }>(
    `mutation { createAnimal(name: "Bess", species: "dog", category: PET) { id } }`,
  );
  return pet.data!.createAnimal.id;
}

async function join(t: ReturnType<typeof buildTestApp>, ann: Gql, farmId: string, role: string) {
  const email = `${role.toLowerCase()}@example.com`;
  const invite = await ann<{ inviteMember: Id }>(
    `mutation ($farmId: ID!, $email: String!, $role: FarmRole!) {
      inviteMember(farmId: $farmId, email: $email, role: $role) { id }
    }`,
    { farmId, email, role },
  );
  const member = await t.signedIn(email);
  await member(`mutation ($id: ID!) { acceptInvite(id: $id) { id } }`, {
    id: invite.data!.inviteMember.id,
  });
  return member;
}

describe('documents (v4)', () => {
  it('stores a farm document for a tagged animal and gives the same file back', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId, taggedId } = await farmWithAnimal(ann);
    const res = await ann<{ addDocument: Record<string, unknown> }>(ADD, {
      input: {
        farmId,
        taggedAnimalId: taggedId,
        kind: 'MOVEMENT',
        fileName: 'C:\\scans\\movement licence.pdf',
        contentBase64: pdf(),
        documentDate: '2026-05-20',
        expiresOn: '2026-06-11',
      },
    });
    expect(res.errors?.[0]?.message).toBeUndefined();
    expect(res.data!.addDocument).toMatchObject({
      kind: 'MOVEMENT',
      title: 'movement licence',
      fileName: 'movement licence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 14,
      expiresOn: '2026-06-11',
      daysToExpiry: 10,
      farmName: 'Hill Farm',
      petName: null,
      uploadedAt: '2026-06-01T09:00:00.000Z',
      // The animal's group comes with it
      group: { name: 'Ewes' },
      taggedAnimal: { tag: 'UK 1' },
    });
    const id = (res.data!.addDocument as Id).id;
    const file = await ann<{ documentFile: Record<string, string> }>(
      `query ($id: ID!) { documentFile(id: $id) { fileName mimeType contentBase64 } }`,
      { id },
    );
    expect(file.data!.documentFile).toEqual({
      fileName: 'movement licence.pdf',
      mimeType: 'application/pdf',
      contentBase64: pdf(),
    });
    const list = await ann<{ documents: Array<{ id: string }> }>(
      `query ($farmId: ID) { documents(farmId: $farmId) { id } }`,
      { farmId },
    );
    expect(list.data!.documents).toEqual([{ id }]);
  });

  it('takes the file type from its contents, not its name, and accepts a data URL', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const petId = await petOf(ann);
    const res = await ann<{ addDocument: Record<string, unknown> }>(ADD, {
      input: {
        petId,
        kind: 'CERTIFICATE',
        title: ' Rabies certificate ',
        fileName: 'photo.pdf',
        contentBase64: `data:image/png;base64,${PNG}`,
      },
    });
    expect(res.errors?.[0]?.message).toBeUndefined();
    expect(res.data!.addDocument).toMatchObject({
      title: 'Rabies certificate',
      mimeType: 'image/png',
      sizeBytes: 11,
      petName: 'Bess',
      farmName: null,
      daysToExpiry: null,
    });
  });

  it.each([
    [{ contentBase64: Buffer.from('<html><script>').toString('base64') }, /PDF, JPEG, PNG or WebP/],
    [{ contentBase64: 'not base64!' }, /could not be read/i],
    [{ contentBase64: '' }, /empty/i],
    [{ contentBase64: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') }, /5 MB/],
    [{ fileName: '  ' }, /file name/i],
    [{ expiresOn: '11/06/2026' }, /YYYY-MM-DD/],
    [{ documentDate: '2026-06-02' }, /future/],
    [{ title: 'x'.repeat(121) }, /120/],
  ])('refuses %#', async (fields, message) => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const petId = await petOf(ann);
    const res = await ann(ADD, {
      input: { petId, kind: 'OTHER', fileName: 'a.pdf', contentBase64: pdf(), ...fields },
    });
    expect(res.errors?.[0]?.message).toMatch(message);
  });

  it('needs exactly one of a farm or a pet, and links only on a farm', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId, groupId } = await farmWithAnimal(ann);
    const petId = await petOf(ann);
    const base = { kind: 'OTHER', fileName: 'a.pdf', contentBase64: pdf() };
    for (const scope of [{}, { farmId, petId }])
      expect((await ann(ADD, { input: { ...base, ...scope } })).errors?.[0]?.message).toMatch(
        /a farm or a pet/,
      );
    const onPet = await ann(ADD, { input: { ...base, petId, groupId } });
    expect(onPet.errors?.[0]?.message).toMatch(/farm/);
  });

  it('refuses a group or animal from another farm', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const a = await farmWithAnimal(ann);
    const b = await farmWithAnimal(ann);
    const base = { farmId: a.farmId, kind: 'OTHER', fileName: 'a.pdf', contentBase64: pdf() };
    for (const link of [{ groupId: b.groupId }, { taggedAnimalId: b.taggedId }]) {
      const res = await ann(ADD, { input: { ...base, ...link } });
      expect(res.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    }
  });

  it('keeps pet documents private to their owner', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn('ann@example.com');
    const bob = await t.signedIn('bob@example.com');
    const petId = await petOf(ann);
    const added = await ann<{ addDocument: Id }>(ADD, {
      input: { petId, kind: 'INSURANCE', fileName: 'policy.pdf', contentBase64: pdf() },
    });
    const id = added.data!.addDocument.id;
    const list = await bob(`query ($petId: ID) { documents(petId: $petId) { id } }`, { petId });
    expect(list.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    const file = await bob(`query ($id: ID!) { documentFile(id: $id) { fileName } }`, { id });
    expect(file.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    const pet = await ann<{ animal: { documents: Array<{ title: string }> } }>(
      `query ($id: ID!) { animal(id: $id) { documents { title } } }`,
      { id: petId },
    );
    expect(pet.data!.animal.documents).toEqual([{ title: 'policy' }]);
  });

  it('lets a viewer read and download but not add, change or delete', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId } = await farmWithAnimal(ann);
    const added = await ann<{ addDocument: Id }>(ADD, {
      input: { farmId, kind: 'RECEIPT', fileName: 'feed.pdf', contentBase64: pdf() },
    });
    const id = added.data!.addDocument.id;
    const viewer = await join(t, ann, farmId, 'VIEWER');
    const list = await viewer<{ documents: Id[] }>(
      `query ($farmId: ID) { documents(farmId: $farmId) { id } }`,
      { farmId },
    );
    expect(list.data!.documents).toEqual([{ id }]);
    const file = await viewer(`query ($id: ID!) { documentFile(id: $id) { fileName } }`, { id });
    expect(file.errors).toBeUndefined();
    const add = await viewer(ADD, {
      input: { farmId, kind: 'OTHER', fileName: 'x.pdf', contentBase64: pdf() },
    });
    expect(add.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    const update = await viewer(
      `mutation ($id: ID!) { updateDocument(id: $id, input: { title: "Mine" }) { id } }`,
      { id },
    );
    expect(update.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    const del = await viewer(`mutation ($id: ID!) { deleteDocument(id: $id) }`, { id });
    expect(del.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('updates details, clears an expiry, and deletes', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const petId = await petOf(ann);
    const added = await ann<{ addDocument: Id }>(ADD, {
      input: {
        petId,
        kind: 'OTHER',
        fileName: 'a.pdf',
        contentBase64: pdf(),
        expiresOn: '2026-05-01',
      },
    });
    const id = added.data!.addDocument.id;
    const updated = await ann<{ updateDocument: Record<string, unknown> }>(
      `mutation ($id: ID!) {
        updateDocument(id: $id, input: { title: "Pet passport", kind: CERTIFICATE, expiresOn: null }) {
          title kind expiresOn daysToExpiry
        }
      }`,
      { id },
    );
    expect(updated.data!.updateDocument).toEqual({
      title: 'Pet passport',
      kind: 'CERTIFICATE',
      expiresOn: null,
      daysToExpiry: null,
    });
    const empty = await ann(
      `mutation ($id: ID!) { updateDocument(id: $id, input: { title: " " }) { id } }`,
      {
        id,
      },
    );
    expect(empty.errors?.[0]?.message).toMatch(/title/i);
    expect((await ann(`mutation ($id: ID!) { deleteDocument(id: $id) }`, { id })).data).toEqual({
      deleteDocument: true,
    });
    expect((await ann(`mutation ($id: ID!) { deleteDocument(id: $id) }`, { id })).data).toEqual({
      deleteDocument: false,
    });
  });

  it('lists documents expiring within 30 days, or already expired, across my farms and pets', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId } = await farmWithAnimal(ann);
    const petId = await petOf(ann);
    const add = (scope: object, title: string, expiresOn: string | null) =>
      ann(ADD, {
        input: {
          ...scope,
          kind: 'OTHER',
          title,
          fileName: 'a.pdf',
          contentBase64: pdf(),
          expiresOn,
        },
      });
    await add({ farmId }, 'Far off', '2026-08-01');
    await add({ farmId }, 'Soon', '2026-06-20');
    await add({ petId }, 'Lapsed', '2026-05-30');
    await add({ petId }, 'Never', null);
    const res = await ann<{ expiringDocuments: Array<{ title: string; daysToExpiry: number }> }>(
      `query { expiringDocuments { title daysToExpiry } }`,
    );
    expect(res.data!.expiringDocuments).toEqual([
      { title: 'Lapsed', daysToExpiry: -2 },
      { title: 'Soon', daysToExpiry: 19 },
    ]);
  });
});

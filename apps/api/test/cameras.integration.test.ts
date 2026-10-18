import { describe, expect, it } from 'vitest';
import { buildTestApp, type Gql } from './fakes';

type Id = { id: string };

const ADD = `mutation ($input: CameraInput!) {
  addCamera(input: $input) { id name url notes field { name } group { name } }
}`;

async function farmWith(gql: Gql) {
  const farm = await gql<{ createFarm: Id }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const field = await gql<{ createField: Id }>(
    `mutation ($farmId: ID!) { createField(input: { farmId: $farmId, name: "Top" }) { id } }`,
    { farmId },
  );
  const group = await gql<{ createLivestockGroup: Id }>(
    `mutation ($farmId: ID!) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Ewes", species: SHEEP, livestockClass: EWES, headCount: 80
      }) { id }
    }`,
    { farmId },
  );
  return {
    farmId,
    fieldId: field.data!.createField.id,
    groupId: group.data!.createLivestockGroup.id,
  };
}

describe('cameras (v4.2)', () => {
  it('saves a CCTV link for a field and a group, with a tidy web address', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId, fieldId, groupId } = await farmWith(ann);
    const res = await ann<{ addCamera: Record<string, unknown> }>(ADD, {
      input: {
        farmId,
        fieldId,
        groupId,
        name: ' Lambing shed ',
        url: 'cams.example.com/shed',
        notes: 'App login on the office wall',
      },
    });
    expect(res.errors?.[0]?.message).toBeUndefined();
    expect(res.data!.addCamera).toMatchObject({
      name: 'Lambing shed',
      url: 'https://cams.example.com/shed',
      field: { name: 'Top' },
      group: { name: 'Ewes' },
    });
    const list = await ann<{ cameras: Array<{ name: string }> }>(
      `query ($farmId: ID!) { cameras(farmId: $farmId) { name } }`,
      { farmId },
    );
    expect(list.data!.cameras).toEqual([{ name: 'Lambing shed' }]);
  });

  it.each([
    [{ name: '' }, /name/i],
    [{ url: '' }, /web address/i],
    [{ url: 'rtsp://192.168.1.20/stream' }, /web address/i],
    [{ url: 'javascript:alert(1)' }, /web address/i],
  ])('refuses %j', async (fields, message) => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId } = await farmWith(ann);
    const res = await ann(ADD, {
      input: { farmId, name: 'Shed', url: 'https://cams.example.com', ...fields },
    });
    expect(res.errors?.[0]?.message).toMatch(message);
  });

  it('refuses a field or group from another farm', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const a = await farmWith(ann);
    const b = await farmWith(ann);
    for (const link of [{ fieldId: b.fieldId }, { groupId: b.groupId }]) {
      const res = await ann(ADD, {
        input: { farmId: a.farmId, name: 'Shed', url: 'https://cams.example.com', ...link },
      });
      expect(res.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    }
  });

  it('updates, clears a link and deletes', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId, groupId } = await farmWith(ann);
    const added = await ann<{ addCamera: Id }>(ADD, {
      input: { farmId, groupId, name: 'Shed', url: 'https://cams.example.com' },
    });
    const id = added.data!.addCamera.id;
    const updated = await ann<{ updateCamera: Record<string, unknown> }>(
      `mutation ($id: ID!) {
        updateCamera(id: $id, input: { name: "Yard", url: "http://yard.example.com", groupId: null }) {
          name url group { name }
        }
      }`,
      { id },
    );
    expect(updated.data!.updateCamera).toEqual({
      name: 'Yard',
      url: 'http://yard.example.com',
      group: null,
    });
    const del = `mutation ($id: ID!) { deleteCamera(id: $id) }`;
    expect((await ann(del, { id })).data).toEqual({ deleteCamera: true });
    expect((await ann(del, { id })).data).toEqual({ deleteCamera: false });
  });

  it('keeps PHOTO as a document kind for camera snapshots', async () => {
    const t = buildTestApp();
    const ann = await t.signedIn();
    const { farmId, groupId } = await farmWith(ann);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString('base64');
    const res = await ann<{ addDocument: { kind: string; mimeType: string } }>(
      `mutation ($input: DocumentInput!) { addDocument(input: $input) { kind mimeType } }`,
      {
        input: {
          farmId,
          groupId,
          kind: 'PHOTO',
          fileName: 'snapshot.jpg',
          contentBase64: `data:image/jpeg;base64,${jpeg}`,
        },
      },
    );
    expect(res.data!.addDocument).toEqual({ kind: 'PHOTO', mimeType: 'image/jpeg' });
  });
});

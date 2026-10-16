import { describe, expect, it } from 'vitest';
import { buildTestApp, type Gql } from './fakes';

const code = (res: { errors?: Array<{ extensions?: { code?: string } }> }) =>
  res.errors?.[0]?.extensions?.code;

type Id = { id: string };

/** Ann owns a farm with a field, a group, a treatment and a task. */
async function annsFarm(ann: Gql) {
  const farm = await ann<{ createFarm: Id }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const field = await ann<{ createField: Id }>(
    `mutation ($farmId: ID!) { createField(input: { farmId: $farmId, name: "Top" }) { id } }`,
    { farmId },
  );
  const group = await ann<{ createLivestockGroup: Id }>(
    `mutation ($farmId: ID!) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Ewes", species: SHEEP, livestockClass: EWES, headCount: 50
      }) { id }
    }`,
    { farmId },
  );
  const groupId = group.data!.createLivestockGroup.id;
  const task = await ann<{ createTask: Id }>(
    `mutation ($groupId: ID!) {
      createTask(input: { groupId: $groupId, title: "Check feet", dueDate: "2026-06-05" }) { id }
    }`,
    { groupId },
  );
  return {
    farmId,
    fieldId: field.data!.createField.id,
    groupId,
    taskId: task.data!.createTask.id,
  };
}

const INVITE = /* GraphQL */ `
  mutation ($farmId: ID!, $email: String!, $role: FarmRole!) {
    inviteMember(farmId: $farmId, email: $email, role: $role) {
      id
      email
      role
    }
  }
`;

async function join(app: ReturnType<typeof buildTestApp>, ann: Gql, farmId: string, role: string) {
  const email = `${role.toLowerCase()}@example.com`;
  const invite = await ann<{ inviteMember: Id }>(INVITE, {
    farmId,
    email: ` ${email.toUpperCase()} `,
    role,
  });
  expect(invite.errors).toBeUndefined();
  const member = await app.signedIn(email);
  const accepted = await member(`mutation ($id: ID!) { acceptInvite(id: $id) { id name } }`, {
    id: invite.data!.inviteMember.id,
  });
  expect(accepted.errors).toBeUndefined();
  return member;
}

describe('farm sharing (FR-8.2)', () => {
  it('invites by email: the invitee sees it when signed in, and accepting adds the farm', async () => {
    const app = buildTestApp();
    const ann = await app.signedIn('ann@example.com');
    const { farmId } = await annsFarm(ann);
    await ann(INVITE, { farmId, email: 'Bob@Example.com', role: 'WORKER' });

    const bob = await app.signedIn('bob@example.com');
    const invites = await bob<{ myInvites: Array<{ id: string; farmName: string; role: string }> }>(
      `query { myInvites { id farmName role invitedBy } }`,
    );
    expect(invites.data!.myInvites).toEqual([
      {
        id: expect.any(String),
        farmName: 'Hill Farm',
        role: 'WORKER',
        invitedBy: 'ann@example.com',
      },
    ]);
    await bob(`mutation ($id: ID!) { acceptInvite(id: $id) { id } }`, {
      id: invites.data!.myInvites[0]!.id,
    });

    const farms = await bob<{ farms: Array<{ name: string; myRole: string }> }>(
      `query { farms { name myRole } }`,
    );
    expect(farms.data!.farms).toEqual([{ name: 'Hill Farm', myRole: 'WORKER' }]);
    expect(
      (await bob<{ myInvites: unknown[] }>(`query { myInvites { id } }`)).data!.myInvites,
    ).toEqual([]);

    const members = await ann<{ farm: { members: unknown[]; invites: unknown[] } }>(
      `query ($id: ID!) { farm(id: $id) { members { email role isMe } invites { email } } }`,
      { id: farmId },
    );
    expect(members.data!.farm).toEqual({
      members: [
        { email: 'ann@example.com', role: 'OWNER', isMe: true },
        { email: 'bob@example.com', role: 'WORKER', isMe: false },
      ],
      invites: [],
    });
  });

  it('emails the invitee a link to sign up or log in', async () => {
    const app = buildTestApp();
    const ann = await app.signedIn('ann@example.com');
    const { farmId } = await annsFarm(ann);
    await ann(INVITE, { farmId, email: 'bob@example.com', role: 'VIEWER' });
    expect(app.email.sent.at(-1)).toMatchObject({
      to: 'bob@example.com',
      subject: expect.stringContaining('Hill Farm'),
    });
    expect(app.email.sent.at(-1)!.text).toContain('https://bellwether.test/farms');
  });

  it("won't let someone accept an invite meant for another email", async () => {
    const app = buildTestApp();
    const ann = await app.signedIn('ann@example.com');
    const { farmId } = await annsFarm(ann);
    const invite = await ann<{ inviteMember: Id }>(INVITE, {
      farmId,
      email: 'bob@example.com',
      role: 'OWNER',
    });
    const eve = await app.signedIn('eve@example.com');
    const res = await eve(`mutation ($id: ID!) { acceptInvite(id: $id) { id } }`, {
      id: invite.data!.inviteMember.id,
    });
    expect(code(res)).toBe('NOT_FOUND');
  });

  it('declines and cancels invites, and rejects inviting an existing member or a bad email', async () => {
    const app = buildTestApp();
    const ann = await app.signedIn('ann@example.com');
    const { farmId } = await annsFarm(ann);
    const bad = await ann(INVITE, { farmId, email: 'not an email', role: 'WORKER' });
    expect(code(bad)).toBe('BAD_INPUT');
    const self = await ann(INVITE, { farmId, email: 'ann@example.com', role: 'WORKER' });
    expect(code(self)).toBe('BAD_INPUT');

    const invite = await ann<{ inviteMember: Id }>(INVITE, {
      farmId,
      email: 'bob@example.com',
      role: 'WORKER',
    });
    const bob = await app.signedIn('bob@example.com');
    const declined = await bob<{ declineInvite: boolean }>(
      `mutation ($id: ID!) { declineInvite(id: $id) }`,
      { id: invite.data!.inviteMember.id },
    );
    expect(declined.data!.declineInvite).toBe(true);

    const again = await ann<{ inviteMember: Id }>(INVITE, {
      farmId,
      email: 'carl@example.com',
      role: 'WORKER',
    });
    const cancelled = await ann<{ cancelInvite: boolean }>(
      `mutation ($id: ID!) { cancelInvite(id: $id) }`,
      { id: again.data!.inviteMember.id },
    );
    expect(cancelled.data!.cancelInvite).toBe(true);
  });

  describe('roles', () => {
    it('lets a viewer read the farm but change nothing', async () => {
      const app = buildTestApp();
      const ann = await app.signedIn('ann@example.com');
      const ids = await annsFarm(ann);
      const viewer = await join(app, ann, ids.farmId, 'VIEWER');

      const read = await viewer<{ farm: { groups: unknown[] } }>(
        `query ($id: ID!) { farm(id: $id) { groups { id treatments { id } } } tasks(farmId: $id) { id } }`,
        { id: ids.farmId },
      );
      expect(read.errors).toBeUndefined();
      expect(read.data!.farm.groups).toHaveLength(1);

      const attempts: Array<[string, Record<string, unknown>]> = [
        [
          `mutation ($groupId: ID!) { recordObservation(input: { groupId: $groupId, date: "2026-06-01", type: "Check" }) { id } }`,
          { groupId: ids.groupId },
        ],
        [`mutation ($id: ID!) { setTaskDone(id: $id, done: true) { id } }`, { id: ids.taskId }],
        [
          `mutation ($farmId: ID!) { createTask(input: { farmId: $farmId, title: "X", dueDate: "2026-06-05" }) { id } }`,
          { farmId: ids.farmId },
        ],
        [
          `mutation ($id: ID!) { updateLivestockGroup(id: $id, input: { headCount: 49 }) { id } }`,
          { id: ids.groupId },
        ],
        [
          `mutation ($groupId: ID!, $fieldId: ID!) { moveLivestockGroup(input: { groupId: $groupId, toFieldId: $fieldId, movedOn: "2026-06-01" }) { id } }`,
          { groupId: ids.groupId, fieldId: ids.fieldId },
        ],
      ];
      for (const [query, variables] of attempts) {
        expect(code(await viewer(query, variables))).toBe('FORBIDDEN');
      }

      // Email settings are personal, so a viewer can set their own
      const prefs = await viewer(
        `mutation ($farmId: ID!) {
          setBriefingPreferences(farmId: $farmId, input: { emailEnabled: false, sendAt: "07:00", alwaysSend: false }) { sendAt }
        }`,
        { farmId: ids.farmId },
      );
      expect(prefs.errors).toBeUndefined();
    });

    it('lets a worker record, move and do tasks, but not manage the farm', async () => {
      const app = buildTestApp();
      const ann = await app.signedIn('ann@example.com');
      const ids = await annsFarm(ann);
      const worker = await join(app, ann, ids.farmId, 'WORKER');

      const allowed: Array<[string, Record<string, unknown>]> = [
        [
          `mutation ($groupId: ID!) { recordObservation(input: { groupId: $groupId, date: "2026-06-01", type: "Check" }) { id } }`,
          { groupId: ids.groupId },
        ],
        [`mutation ($id: ID!) { setTaskDone(id: $id, done: true) { id } }`, { id: ids.taskId }],
        [
          `mutation ($groupId: ID!, $fieldId: ID!) { moveLivestockGroup(input: { groupId: $groupId, toFieldId: $fieldId, movedOn: "2026-06-01" }) { id } }`,
          { groupId: ids.groupId, fieldId: ids.fieldId },
        ],
      ];
      for (const [query, variables] of allowed) {
        expect((await worker(query, variables)).errors).toBeUndefined();
      }

      const forbidden: Array<[string, Record<string, unknown>]> = [
        [
          `mutation ($id: ID!) { updateFarm(id: $id, input: { name: "Mine" }) { id } }`,
          { id: ids.farmId },
        ],
        [
          `mutation ($farmId: ID!) { createField(input: { farmId: $farmId, name: "New" }) { id } }`,
          { farmId: ids.farmId },
        ],
        [
          `mutation ($id: ID!) { archiveLivestockGroup(id: $id, input: { archivedOn: "2026-06-01", reason: "x" }) { id } }`,
          { id: ids.groupId },
        ],
        [
          `mutation ($farmId: ID!) { inviteMember(farmId: $farmId, email: "x@example.com", role: OWNER) { id } }`,
          { farmId: ids.farmId },
        ],
        [
          `mutation ($id: ID!) { deleteFarm(id: $id, confirmName: "Hill Farm") }`,
          { id: ids.farmId },
        ],
      ];
      for (const [query, variables] of forbidden) {
        expect(code(await worker(query, variables))).toBe('FORBIDDEN');
      }
    });

    it('lets the owner change roles and remove members, but never the last owner', async () => {
      const app = buildTestApp();
      const ann = await app.signedIn('ann@example.com');
      const ids = await annsFarm(ann);
      const bob = await join(app, ann, ids.farmId, 'WORKER');
      const bobId = (await bob<{ me: Id }>(`query { me { id } }`)).data!.me.id;
      const annId = (await ann<{ me: Id }>(`query { me { id } }`)).data!.me.id;

      const demoteSelf = await ann(
        `mutation ($farmId: ID!, $userId: ID!) { setMemberRole(farmId: $farmId, userId: $userId, role: VIEWER) }`,
        { farmId: ids.farmId, userId: annId },
      );
      expect(code(demoteSelf)).toBe('BAD_INPUT');

      const promoted = await ann<{ setMemberRole: boolean }>(
        `mutation ($farmId: ID!, $userId: ID!) { setMemberRole(farmId: $farmId, userId: $userId, role: VIEWER) }`,
        { farmId: ids.farmId, userId: bobId },
      );
      expect(promoted.data!.setMemberRole).toBe(true);

      const removed = await ann<{ removeMember: boolean }>(
        `mutation ($farmId: ID!, $userId: ID!) { removeMember(farmId: $farmId, userId: $userId) }`,
        { farmId: ids.farmId, userId: bobId },
      );
      expect(removed.data!.removeMember).toBe(true);
      expect((await bob<{ farms: unknown[] }>(`query { farms { id } }`)).data!.farms).toEqual([]);

      const leaveAlone = await ann(
        `mutation ($farmId: ID!, $userId: ID!) { removeMember(farmId: $farmId, userId: $userId) }`,
        { farmId: ids.farmId, userId: annId },
      );
      expect(code(leaveAlone)).toBe('BAD_INPUT');
    });

    it('lets a member leave a farm', async () => {
      const app = buildTestApp();
      const ann = await app.signedIn('ann@example.com');
      const ids = await annsFarm(ann);
      const bob = await join(app, ann, ids.farmId, 'VIEWER');
      const bobId = (await bob<{ me: Id }>(`query { me { id } }`)).data!.me.id;
      const left = await bob<{ removeMember: boolean }>(
        `mutation ($farmId: ID!, $userId: ID!) { removeMember(farmId: $farmId, userId: $userId) }`,
        { farmId: ids.farmId, userId: bobId },
      );
      expect(left.data!.removeMember).toBe(true);
    });
  });

  describe('assigning tasks (FR-5.4)', () => {
    it('assigns a task to a worker, who sees it as theirs', async () => {
      const app = buildTestApp();
      const ann = await app.signedIn('ann@example.com');
      const ids = await annsFarm(ann);
      const bob = await join(app, ann, ids.farmId, 'WORKER');
      const bobId = (await bob<{ me: Id }>(`query { me { id } }`)).data!.me.id;

      const assigned = await ann<{ updateTask: unknown }>(
        `mutation ($id: ID!, $userId: ID) { updateTask(id: $id, input: { assigneeId: $userId }) { assignee { email } } }`,
        { id: ids.taskId, userId: bobId },
      );
      expect(assigned.data!.updateTask).toEqual({ assignee: { email: 'worker@example.com' } });

      const mine = await bob<{ tasks: Array<{ assignedToMe: boolean }> }>(
        `query ($farmId: ID!) { tasks(farmId: $farmId) { assignedToMe } }`,
        { farmId: ids.farmId },
      );
      expect(mine.data!.tasks).toEqual([{ assignedToMe: true }]);
    });

    it("won't assign to a viewer or someone who isn't a member", async () => {
      const app = buildTestApp();
      const ann = await app.signedIn('ann@example.com');
      const ids = await annsFarm(ann);
      const viewer = await join(app, ann, ids.farmId, 'VIEWER');
      const viewerId = (await viewer<{ me: Id }>(`query { me { id } }`)).data!.me.id;
      const stranger = await app.signedIn('stranger@example.com');
      const strangerId = (await stranger<{ me: Id }>(`query { me { id } }`)).data!.me.id;
      for (const userId of [viewerId, strangerId]) {
        const res = await ann(
          `mutation ($id: ID!, $userId: ID) { updateTask(id: $id, input: { assigneeId: $userId }) { id } }`,
          { id: ids.taskId, userId },
        );
        expect(code(res)).toBe('BAD_INPUT');
      }
    });
  });
});

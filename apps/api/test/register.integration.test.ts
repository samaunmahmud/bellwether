import { describe, expect, it } from 'vitest';
import { buildTestApp, type Gql } from './fakes';

const code = (res: { errors?: Array<{ extensions?: { code?: string } }> }) =>
  res.errors?.[0]?.extensions?.code;

type Id = { id: string };

// buildTestApp's clock is 2026-06-01, 09:00 UTC.
async function setUp(email = 'ann@example.com') {
  const app = buildTestApp();
  const ann = await app.signedIn(email);
  const farm = await ann<{ createFarm: Id }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const group = await ann<{ createLivestockGroup: Id }>(
    `mutation ($farmId: ID!) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Ewes", species: SHEEP, livestockClass: EWES, headCount: 100
      }) { id }
    }`,
    { farmId },
  );
  return { app, ann, farmId, groupId: group.data!.createLivestockGroup.id };
}

const RECORD = /* GraphQL */ `
  mutation ($input: RegisterEventInput!) {
    recordRegisterEvent(input: $input) {
      id
      kind
      date
      count
      bornDead
      value
      otherParty
      cause
      recordedBy
      voided
      group {
        id
        headCount
      }
    }
  }
`;

type Recorded = { recordRegisterEvent: { id: string; group: { headCount: number } } };

const headCount = async (gql: Gql, id: string) =>
  (
    await gql<{ livestockGroup: { headCount: number } }>(
      `query ($id: ID!) { livestockGroup(id: $id) { headCount } }`,
      { id },
    )
  ).data!.livestockGroup.headCount;

describe('holding register (v3)', () => {
  it('records a death, who recorded it, and takes it off the head count', async () => {
    const { ann, groupId } = await setUp();
    const res = await ann<Recorded>(RECORD, {
      input: { groupId, kind: 'DEATH', date: '2026-05-30', count: 2, cause: ' Found dead ' },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data!.recordRegisterEvent).toMatchObject({
      kind: 'DEATH',
      count: 2,
      cause: 'Found dead',
      recordedBy: 'ann@example.com',
      voided: false,
      group: { headCount: 98 },
    });
  });

  it('adds births and animals moved on; takes off animals moved off', async () => {
    const { ann, groupId } = await setUp();
    await ann(RECORD, {
      input: { groupId, kind: 'BIRTH', date: '2026-05-01', count: 30, bornDead: 2 },
    });
    await ann(RECORD, {
      input: {
        groupId,
        kind: 'MOVE_ON',
        date: '2026-05-02',
        count: 5,
        otherParty: 'Low Farm 12/345/6789',
      },
    });
    await ann(RECORD, {
      input: {
        groupId,
        kind: 'MOVE_OFF',
        date: '2026-05-20',
        count: 10,
        otherParty: 'Kendal market',
      },
    });
    expect(await headCount(ann, groupId)).toBe(125);
  });

  it('sets the head count from a count (e.g. on 1 December)', async () => {
    const { ann, groupId } = await setUp();
    await ann(RECORD, { input: { groupId, kind: 'HEAD_COUNT', date: '2026-05-31', count: 97 } });
    expect(await headCount(ann, groupId)).toBe(97);
  });

  it('keeps measurements without changing the head count', async () => {
    const { ann, groupId } = await setUp();
    const res = await ann<Recorded>(RECORD, {
      input: { groupId, kind: 'WEIGHING', date: '2026-05-31', count: 20, value: 34.5 },
    });
    expect(res.data!.recordRegisterEvent).toMatchObject({ value: 34.5, group: { headCount: 100 } });
  });

  it.each([
    [{ kind: 'DEATH', date: '2026-06-02', count: 1 }, 'future'],
    [{ kind: 'DEATH', date: '2026-05-01', count: 101 }, 'more than'],
    [{ kind: 'DEATH', date: '2026-05-01', count: 0 }, 'at least 1'],
    [{ kind: 'MOVE_OFF', date: '2026-05-01', count: 3 }, 'where'],
    [{ kind: 'MOVE_ON', date: '2026-05-01', count: 3, otherParty: ' ' }, 'where'],
    [{ kind: 'BIRTH', date: '2026-05-01', count: 0, bornDead: 0 }, 'at least one'],
    [{ kind: 'WEIGHING', date: '2026-05-01', count: 5 }, 'weight'],
    [{ kind: 'WEIGHING', date: '2026-05-01', count: 5, value: 0 }, 'weight'],
    [{ kind: 'FEC', date: '2026-05-01', count: 10, value: -1 }, 'eggs'],
    [{ kind: 'BODY_CONDITION', date: '2026-05-01', count: 10, value: 6 }, '1 to 5'],
  ])('refuses %o', async (input, message) => {
    const { ann, groupId } = await setUp();
    const res = await ann(RECORD, { input: { groupId, ...input } });
    expect(code(res)).toBe('BAD_INPUT');
    expect(res.errors![0]!.message).toContain(message);
    expect(await headCount(ann, groupId)).toBe(100);
  });

  it('voids an event with a reason and puts the head count back', async () => {
    const { ann, groupId } = await setUp();
    const saved = await ann<Recorded>(RECORD, {
      input: { groupId, kind: 'DEATH', date: '2026-05-30', count: 3 },
    });
    const res = await ann<{ voidRegisterEvent: { voided: boolean; voidReason: string } }>(
      `mutation ($id: ID!) { voidRegisterEvent(id: $id, reason: "Wrong group") { voided voidReason } }`,
      { id: saved.data!.recordRegisterEvent.id },
    );
    expect(res.data!.voidRegisterEvent).toEqual({ voided: true, voidReason: 'Wrong group' });
    expect(await headCount(ann, groupId)).toBe(100);

    const again = await ann(
      `mutation ($id: ID!) { voidRegisterEvent(id: $id, reason: "Again") { voided } }`,
      { id: saved.data!.recordRegisterEvent.id },
    );
    expect(code(again)).toBe('BAD_INPUT');
  });

  it('lists the register newest first with the running head count after each event', async () => {
    const { ann, farmId, groupId } = await setUp();
    await ann(RECORD, { input: { groupId, kind: 'BIRTH', date: '2026-04-01', count: 10 } });
    await ann(RECORD, { input: { groupId, kind: 'DEATH', date: '2026-05-01', count: 1 } });
    await ann(RECORD, {
      input: { groupId, kind: 'FEC', date: '2026-05-10', count: 10, value: 450 },
    });
    const res = await ann<{ holdingRegister: unknown[] }>(
      `query ($farmId: ID!) {
        holdingRegister(farmId: $farmId) { headCountAfter event { kind date } }
      }`,
      { farmId },
    );
    expect(res.data!.holdingRegister).toEqual([
      { headCountAfter: 109, event: { kind: 'DEATH', date: '2026-05-01' } },
      { headCountAfter: 110, event: { kind: 'BIRTH', date: '2026-04-01' } },
    ]);
  });

  it("works out a group's weights with daily live-weight gain between weighings", async () => {
    const { ann, groupId } = await setUp();
    await ann(RECORD, {
      input: { groupId, kind: 'WEIGHING', date: '2026-05-01', count: 20, value: 30 },
    });
    await ann(RECORD, {
      input: { groupId, kind: 'WEIGHING', date: '2026-05-21', count: 20, value: 35 },
    });
    const res = await ann<{ livestockGroup: { weights: unknown[] } }>(
      `query ($id: ID!) { livestockGroup(id: $id) { weights { date averageKg dailyGainKg } } }`,
      { id: groupId },
    );
    expect(res.data!.livestockGroup.weights).toEqual([
      { date: '2026-05-01', averageKg: 30, dailyGainKg: null },
      { date: '2026-05-21', averageKg: 35, dailyGainKg: 0.25 },
    ]);
  });

  it('lets a viewer read the register but not add to it', async () => {
    const { app, ann, farmId, groupId } = await setUp();
    const invite = await ann<{ inviteMember: Id }>(
      `mutation ($farmId: ID!) { inviteMember(farmId: $farmId, email: "vic@example.com", role: VIEWER) { id } }`,
      { farmId },
    );
    const vic = await app.signedIn('vic@example.com');
    await vic(`mutation ($id: ID!) { acceptInvite(id: $id) { id } }`, {
      id: invite.data!.inviteMember.id,
    });
    const res = await vic(RECORD, {
      input: { groupId, kind: 'DEATH', date: '2026-05-01', count: 1 },
    });
    expect(code(res)).toBe('FORBIDDEN');
    const read = await vic(
      `query ($farmId: ID!) { holdingRegister(farmId: $farmId) { headCountAfter } }`,
      {
        farmId,
      },
    );
    expect(read.errors).toBeUndefined();
  });

  it("keeps other people's farms out of reach", async () => {
    const { app, farmId, groupId } = await setUp();
    const eve = await app.signedIn('eve@example.com');
    expect(
      code(await eve(RECORD, { input: { groupId, kind: 'DEATH', date: '2026-05-01', count: 1 } })),
    ).toBe('NOT_FOUND');
    expect(
      code(
        await eve(`query ($farmId: ID!) { holdingRegister(farmId: $farmId) { headCountAfter } }`, {
          farmId,
        }),
      ),
    ).toBe('NOT_FOUND');
  });
});

const ADD_MEDICINE = /* GraphQL */ `
  mutation ($farmId: ID!, $input: MedicineInput!) {
    addMedicine(farmId: $farmId, input: $input) {
      id
      productName
      expiryDate
      status
      meatWithdrawalDays
    }
  }
`;

describe('medicine cabinet (v3)', () => {
  it('adds products and flags expired and soon-to-expire ones', async () => {
    const { ann, farmId } = await setUp();
    for (const [productName, expiryDate] of [
      ['Old', '2026-05-31'],
      ['Soon', '2026-06-20'],
      ['Fine', '2027-01-01'],
    ])
      await ann(ADD_MEDICINE, {
        farmId,
        input: { productName, expiryDate, meatWithdrawalDays: 28 },
      });
    const res = await ann<{ medicines: Array<{ productName: string; status: string }> }>(
      `query ($farmId: ID!) { medicines(farmId: $farmId) { productName status } }`,
      { farmId },
    );
    expect(res.data!.medicines).toEqual([
      { productName: 'Old', status: 'EXPIRED' },
      { productName: 'Soon', status: 'EXPIRING' },
      { productName: 'Fine', status: 'OK' },
    ]);
  });

  it('marks a product finished, updates and deletes it', async () => {
    const { ann, farmId } = await setUp();
    const added = await ann<{ addMedicine: Id }>(ADD_MEDICINE, {
      farmId,
      input: { productName: 'X', expiryDate: '2027-01-01' },
    });
    const id = added.data!.addMedicine.id;
    const updated = await ann<{ updateMedicine: unknown }>(
      `mutation ($id: ID!) { updateMedicine(id: $id, input: { finishedOn: "2026-05-31", quantity: "None left" }) { status quantity } }`,
      { id },
    );
    expect(updated.data!.updateMedicine).toEqual({ status: 'FINISHED', quantity: 'None left' });
    const deleted = await ann<{ deleteMedicine: boolean }>(
      `mutation ($id: ID!) { deleteMedicine(id: $id) }`,
      { id },
    );
    expect(deleted.data!.deleteMedicine).toBe(true);
  });

  it('needs a product name and sensible withdrawal days', async () => {
    const { ann, farmId } = await setUp();
    expect(code(await ann(ADD_MEDICINE, { farmId, input: { productName: ' ' } }))).toBe(
      'BAD_INPUT',
    );
    expect(
      code(
        await ann(ADD_MEDICINE, { farmId, input: { productName: 'X', meatWithdrawalDays: -1 } }),
      ),
    ).toBe('BAD_INPUT');
  });
});

describe('holding details, dashboard and alerts (v3)', () => {
  it('saves the CPH number and flock mark', async () => {
    const { ann, farmId } = await setUp();
    const res = await ann<{ updateFarm: unknown }>(
      `mutation ($id: ID!) {
        updateFarm(id: $id, input: { cphNumber: " 12/345/6789 ", flockMark: "UK 123456" }) { cphNumber flockMark }
      }`,
      { id: farmId },
    );
    expect(res.data!.updateFarm).toEqual({ cphNumber: '12/345/6789', flockMark: 'UK 123456' });
  });

  it('sums up the farm: head count by species, losses and births over 12 months', async () => {
    const { ann, farmId, groupId } = await setUp();
    await ann(
      `mutation ($farmId: ID!) {
      createLivestockGroup(input: { farmId: $farmId, name: "Cows", species: CATTLE, livestockClass: BEEF_CATTLE, headCount: 20 }) { id }
    }`,
      { farmId },
    );
    await ann(RECORD, {
      input: { groupId, kind: 'BIRTH', date: '2026-04-01', count: 18, bornDead: 2 },
    });
    await ann(RECORD, { input: { groupId, kind: 'DEATH', date: '2026-05-01', count: 3 } });
    const res = await ann<{ farm: { stats: unknown } }>(
      `query ($id: ID!) { farm(id: $id) { stats {
        totalHead sheep cattle bornAlive bornDead deaths movedOn movedOff
        mortalityPct birthSurvivalPct groupsInWithdrawal openTasks overdueTasks
      } } }`,
      { id: farmId },
    );
    expect(res.data!.farm.stats).toEqual({
      totalHead: 135,
      sheep: 115,
      cattle: 20,
      bornAlive: 18,
      bornDead: 2,
      deaths: 3,
      movedOn: 0,
      movedOff: 0,
      // 3 deaths out of 120 at the start + 18 born
      mortalityPct: 2.2,
      birthSurvivalPct: 90,
      groupsInWithdrawal: 0,
      openTasks: 0,
      overdueTasks: 0,
    });
  });

  it('raises alerts for overdue tasks and medicines that are out of date', async () => {
    const { ann, farmId, groupId } = await setUp();
    await ann(
      `mutation ($groupId: ID!) {
      createTask(input: { groupId: $groupId, title: "Trim feet", dueDate: "2026-05-20" }) { id }
    }`,
      { groupId },
    );
    await ann(ADD_MEDICINE, { farmId, input: { productName: 'Old', expiryDate: '2026-05-01' } });
    const res = await ann<{ farm: { alerts: Array<{ level: string; title: string }> } }>(
      `query ($id: ID!) { farm(id: $id) { alerts { level title detail link } } }`,
      { id: farmId },
    );
    expect(res.data!.farm.alerts.map((a) => [a.level, a.title])).toEqual([
      ['URGENT', 'Overdue: Trim feet'],
      ['URGENT', 'Out of date: Old'],
    ]);
  });

  it('shows recent activity across the farm, newest first', async () => {
    const { ann, farmId, groupId } = await setUp();
    await ann(RECORD, {
      input: { groupId, kind: 'DEATH', date: '2026-05-01', count: 1, cause: 'Old age' },
    });
    await ann(
      `mutation ($groupId: ID!) {
      recordTreatment(input: { groupId: $groupId, date: "2026-05-10", productName: "Label product",
        animalsTreated: 5, administeredBy: "Ann", meatWithdrawalDays: 7 }) { id }
    }`,
      { groupId },
    );
    const res = await ann<{ farm: { activity: Array<{ date: string; title: string }> } }>(
      `query ($id: ID!) { farm(id: $id) { activity(limit: 10) { date title detail groupName } } }`,
      { id: farmId },
    );
    expect(res.data!.farm.activity.map((a) => [a.date, a.title])).toEqual([
      ['2026-05-10', 'Treated 5 with Label product'],
      ['2026-05-01', '1 died'],
    ]);
  });

  it("gives the farm's location and 14-day weather", async () => {
    const { ann, farmId } = await setUp();
    const res = await ann<{ farm: { location: unknown; weather: unknown[] } }>(
      `query ($id: ID!) { farm(id: $id) {
        location { latitude longitude }
        weather { date tempMaxC tempMinC precipitationMm humidityMeanPct }
      } }`,
      { id: farmId },
    );
    expect(res.data!.farm.location).toEqual({ latitude: 51.5326, longitude: -0.4729 });
    expect(res.data!.farm.weather).toHaveLength(14);
  });

  it('says how long each field has been grazed or rested', async () => {
    const { ann, farmId, groupId } = await setUp();
    const field = async (name: string) =>
      (
        await ann<{ createField: Id }>(
          `mutation ($farmId: ID!, $name: String!) { createField(input: { farmId: $farmId, name: $name }) { id } }`,
          { farmId, name },
        )
      ).data!.createField.id;
    const top = await field('Top');
    const low = await field('Low');
    await field('Never');
    const move = `mutation ($groupId: ID!, $to: ID!, $on: String!) {
      moveLivestockGroup(input: { groupId: $groupId, toFieldId: $to, movedOn: $on }) { id }
    }`;
    await ann(move, { groupId, to: top, on: '2026-05-01' });
    await ann(move, { groupId, to: low, on: '2026-05-21' });
    const res = await ann<{ farm: { fields: unknown[] } }>(
      `query ($id: ID!) { farm(id: $id) { fields { name grazing { status days groups } } } }`,
      { id: farmId },
    );
    expect(res.data!.farm.fields).toEqual([
      { name: 'Low', grazing: { status: 'GRAZED', days: 11, groups: ['Ewes'] } },
      { name: 'Never', grazing: { status: 'NEVER_USED', days: null, groups: [] } },
      { name: 'Top', grazing: { status: 'RESTING', days: 11, groups: [] } },
    ]);
  });
});

describe('demo farm (v3)', () => {
  it('builds a farm with fields, groups, records, tasks and medicines to explore', async () => {
    const app = buildTestApp();
    const ann = await app.signedIn();
    const res = await ann<{ createDemoFarm: { id: string; name: string } }>(
      `mutation { createDemoFarm(postcode: "UB8 3PH") { id name } }`,
    );
    expect(res.errors).toBeUndefined();
    const farmId = res.data!.createDemoFarm.id;
    const farm = await ann<{
      farm: { fields: unknown[]; groups: unknown[]; myRole: string };
      holdingRegister: unknown[];
      medicines: unknown[];
      tasks: unknown[];
    }>(
      `query ($id: ID!) {
        farm(id: $id) { myRole fields { id } groups { id } }
        holdingRegister(farmId: $id) { headCountAfter }
        medicines(farmId: $id) { id }
        tasks(farmId: $id) { id }
      }`,
      { id: farmId },
    );
    expect(farm.errors).toBeUndefined();
    expect(farm.data!.farm.myRole).toBe('OWNER');
    expect(farm.data!.farm.fields.length).toBeGreaterThanOrEqual(4);
    expect(farm.data!.farm.groups.length).toBeGreaterThanOrEqual(4);
    expect(farm.data!.holdingRegister.length).toBeGreaterThan(5);
    expect(farm.data!.medicines.length).toBeGreaterThan(2);
    expect(farm.data!.tasks.length).toBeGreaterThan(3);
  });
});

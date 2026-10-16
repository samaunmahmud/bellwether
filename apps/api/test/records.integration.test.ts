import { describe, expect, it } from 'vitest';
import { buildTestApp, type Gql } from './fakes';

const RECORD_TREATMENT = /* GraphQL */ `
  mutation ($input: RecordTreatmentInput!) {
    recordTreatment(input: $input) {
      id
      date
      productName
      animalsTreated
      meatWithdrawalDays
      meatWithdrawalEnds
      milkWithdrawalEnds
    }
  }
`;

const RECORD_OBSERVATION = /* GraphQL */ `
  mutation ($input: RecordObservationInput!) {
    recordObservation(input: $input) {
      id
      date
      type
      note
    }
  }
`;

const GROUP = /* GraphQL */ `
  query ($id: ID!) {
    livestockGroup(id: $id) {
      name
      farm {
        name
      }
      withdrawal {
        inWithdrawal
        meatEnds
        milkEnds
      }
      treatments {
        productName
        date
      }
      observations {
        type
        note
      }
    }
  }
`;

async function setUp(now: string) {
  const t = buildTestApp({ now: () => new Date(now) });
  const gql = await t.signedIn();
  const farm = await gql<{ createFarm: { id: string } }>(
    `mutation { createFarm(input: { name: "Hill Farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const group = await gql<{ createLivestockGroup: { id: string } }>(
    `mutation ($farmId: ID!) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Dairy herd", species: CATTLE, livestockClass: DAIRY_COWS, headCount: 80
      }) { id }
    }`,
    { farmId },
  );
  return { gql, farmId, groupId: group.data!.createLivestockGroup.id };
}

const treatment = (groupId: string, overrides: Record<string, unknown> = {}) => ({
  groupId,
  date: '2026-06-01',
  productName: 'Product from label',
  batchNumber: 'B123',
  quantityUsed: '400 ml',
  animalsTreated: 12,
  administeredBy: 'Ann',
  reason: 'Lameness',
  meatWithdrawalDays: 28,
  milkWithdrawalDays: 3,
  ...overrides,
});

type GroupData = {
  livestockGroup: {
    withdrawal: { inWithdrawal: boolean; meatEnds: string | null; milkEnds: string | null };
    treatments: Array<{ productName: string }>;
    observations: Array<{ type: string; note: string | null }>;
    farm: { name: string };
  };
};

async function withdrawalOn(gql: Gql, groupId: string) {
  const res = await gql<GroupData>(GROUP, { id: groupId });
  expect(res.errors).toBeUndefined();
  return res.data!.livestockGroup.withdrawal;
}

describe('treatment records (FR-6.1, FR-6.2)', () => {
  it('records a treatment and shows its withdrawal end dates', async () => {
    const { gql, groupId } = await setUp('2026-06-10T09:00:00Z');
    const res = await gql(RECORD_TREATMENT, { input: treatment(groupId) });
    expect(res.errors).toBeUndefined();
    expect(res.data).toEqual({
      recordTreatment: {
        id: expect.any(String),
        date: '2026-06-01',
        productName: 'Product from label',
        animalsTreated: 12,
        meatWithdrawalDays: 28,
        meatWithdrawalEnds: '2026-06-29',
        milkWithdrawalEnds: '2026-06-04',
      },
    });
  });

  it('flags the group "In withdrawal" on 28 June but not 29 June (FR-6.2 acceptance)', async () => {
    const on28 = await setUp('2026-06-28T09:00:00Z');
    await on28.gql(RECORD_TREATMENT, {
      input: treatment(on28.groupId, { milkWithdrawalDays: null }),
    });
    expect(await withdrawalOn(on28.gql, on28.groupId)).toEqual({
      inWithdrawal: true,
      meatEnds: '2026-06-29',
      milkEnds: null,
    });

    const on29 = await setUp('2026-06-29T09:00:00Z');
    await on29.gql(RECORD_TREATMENT, {
      input: treatment(on29.groupId, { milkWithdrawalDays: null }),
    });
    expect(await withdrawalOn(on29.gql, on29.groupId)).toEqual({
      inWithdrawal: false,
      meatEnds: null,
      milkEnds: null,
    });
  });

  it('refuses more animals than the group has', async () => {
    const { gql, groupId } = await setUp('2026-06-10T09:00:00Z');
    const res = await gql(RECORD_TREATMENT, { input: treatment(groupId, { animalsTreated: 81 }) });
    expect(res.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
  });
});

describe('checks and observations (FR-6.6)', () => {
  it('records a check against a group and lists it', async () => {
    const { gql, groupId } = await setUp('2026-06-10T09:00:00Z');
    const res = await gql(RECORD_OBSERVATION, {
      input: { groupId, date: '2026-06-10', type: 'Herd check', note: '2 lame cows' },
    });
    expect(res.errors).toBeUndefined();

    const group = await gql<GroupData>(GROUP, { id: groupId });
    expect(group.data!.livestockGroup.observations).toEqual([
      { type: 'Herd check', note: '2 lame cows' },
    ]);
    expect(group.data!.livestockGroup.farm.name).toBe('Hill Farm');
  });
});

describe('treatments export (FR-6.4)', () => {
  it('lists a farm’s treatments in a date range, oldest first, with group names', async () => {
    const { gql, farmId, groupId } = await setUp('2026-07-10T09:00:00Z');
    for (const date of ['2026-07-01', '2026-05-31', '2026-06-15']) {
      await gql(RECORD_TREATMENT, { input: treatment(groupId, { date }) });
    }
    const res = await gql<{ treatments: Array<{ date: string; group: { name: string } }> }>(
      `query ($farmId: ID!) {
        treatments(farmId: $farmId, from: "2026-06-01", to: "2026-07-01") { date group { name } }
      }`,
      { farmId },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.treatments).toEqual([
      { date: '2026-06-15', group: { name: 'Dairy herd' } },
      { date: '2026-07-01', group: { name: 'Dairy herd' } },
    ]);
  });
});

describe('corrections and voids (FR-6.5)', () => {
  const CORRECT = /* GraphQL */ `
    mutation ($id: ID!, $input: CorrectTreatmentInput!, $reason: String!) {
      correctTreatment(id: $id, input: $input, reason: $reason) {
        id
        batchNumber
        voided
        history {
          action
          by
          reason
          at
          changes {
            field
            from
            to
          }
        }
      }
    }
  `;

  it('corrects a treatment and shows who changed what, and why', async () => {
    const { gql, groupId } = await setUp('2026-06-28T09:00:00Z');
    const saved = await gql<{ recordTreatment: { id: string } }>(RECORD_TREATMENT, {
      input: { ...treatment(groupId), batchNumber: 'B123' },
    });
    const res = await gql<{ correctTreatment: Record<string, unknown> }>(CORRECT, {
      id: saved.data!.recordTreatment.id,
      input: { batchNumber: 'B124' },
      reason: 'Typo',
    });
    expect(res.errors).toBeUndefined();
    expect(res.data!.correctTreatment).toEqual({
      id: saved.data!.recordTreatment.id,
      batchNumber: 'B124',
      voided: false,
      history: [
        {
          action: 'EDITED',
          by: 'ann@example.com',
          reason: 'Typo',
          at: '2026-06-28T09:00:00.000Z',
          changes: [{ field: 'Batch number', from: 'B123', to: 'B124' }],
        },
      ],
    });
  });

  it('voids a treatment: still listed, marked void, and the group leaves withdrawal', async () => {
    const { gql, groupId } = await setUp('2026-06-28T09:00:00Z');
    const saved = await gql<{ recordTreatment: { id: string } }>(RECORD_TREATMENT, {
      input: { ...treatment(groupId), date: '2026-06-20' },
    });
    const res = await gql<{ voidTreatment: { voided: boolean; voidReason: string } }>(
      `mutation ($id: ID!) {
        voidTreatment(id: $id, reason: "Entered twice") { voided voidReason }
      }`,
      { id: saved.data!.recordTreatment.id },
    );
    expect(res.data!.voidTreatment).toEqual({ voided: true, voidReason: 'Entered twice' });

    const group = await gql<{
      livestockGroup: { withdrawal: { inWithdrawal: boolean }; treatments: unknown[] };
    }>(GROUP, { id: groupId });
    expect(group.data!.livestockGroup.withdrawal.inWithdrawal).toBe(false);
    expect(group.data!.livestockGroup.treatments).toHaveLength(1);
  });

  it('corrects and voids a check', async () => {
    const { gql, groupId } = await setUp('2026-06-28T09:00:00Z');
    const saved = await gql<{ recordObservation: { id: string } }>(RECORD_OBSERVATION, {
      input: { groupId, date: '2026-06-27', type: 'Flock inspected' },
    });
    const id = saved.data!.recordObservation.id;
    const fixed = await gql<{ correctObservation: { note: string } }>(
      `mutation ($id: ID!) {
        correctObservation(id: $id, input: { note: "2 struck" }, reason: "Add note") { note }
      }`,
      { id },
    );
    expect(fixed.data!.correctObservation.note).toBe('2 struck');
    const voided = await gql<{ voidObservation: { voided: boolean; history: unknown[] } }>(
      `mutation ($id: ID!) { voidObservation(id: $id, reason: "Wrong group") { voided history { action } } }`,
      { id },
    );
    expect(voided.data!.voidObservation).toEqual({
      voided: true,
      history: [{ action: 'VOIDED' }, { action: 'EDITED' }],
    });
  });

  it('needs a reason', async () => {
    const { gql, groupId } = await setUp('2026-06-28T09:00:00Z');
    const saved = await gql<{ recordTreatment: { id: string } }>(RECORD_TREATMENT, {
      input: treatment(groupId),
    });
    const res = await gql(CORRECT, {
      id: saved.data!.recordTreatment.id,
      input: { batchNumber: 'B9' },
      reason: '  ',
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
  });
});

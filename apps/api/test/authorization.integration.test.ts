import { buildSchema, type GraphQLObjectType } from 'graphql';
import { beforeEach, describe, expect, it } from 'vitest';
import { typeDefs } from '../src/schema/typeDefs';
import { buildTestApp, type Gql } from './fakes';

/**
 * FR-8.4: a user can't read or change another farm's (or another owner's) data
 * through any query or mutation.
 */

// Operations that read no user data, so anyone may call them (A15).
const PUBLIC = ['forecast', 'me', 'signUp', 'logIn', 'logOut'];

const TREATMENT_FIELDS = `
  groupId: $groupId, date: "2026-06-01", productName: "X", animalsTreated: 1,
  administeredBy: "Bob", meatWithdrawalDays: 0
`;

interface AnnsData {
  taskId: string;
  farmId: string;
  fieldId: string;
  otherFieldId: string;
  groupId: string;
  animalId: string;
  logId: string;
  treatmentId: string;
  observationId: string;
}

interface BobsData {
  farmId: string;
  groupId: string;
}

type Attempt = (bob: Gql, ann: AnnsData, bobs: BobsData) => Promise<void>;

const code = (res: { errors?: Array<{ extensions?: { code?: string } }> }) =>
  res.errors?.[0]?.extensions?.code;

// Every protected operation, with what happens when Bob aims it at Ann's data.
const CROSS_USER: Record<string, Attempt> = {
  farms: async (bob, _ann, bobs) => {
    // Only Bob's own farm, never Ann's
    expect((await bob(`query { farms { id } }`)).data).toEqual({ farms: [{ id: bobs.farmId }] });
  },
  farm: async (bob, ann) => {
    const res = await bob(`query ($id: ID!) { farm(id: $id) { id } }`, { id: ann.farmId });
    expect(res.data).toEqual({ farm: null });
  },
  animals: async (bob) => {
    expect((await bob(`query { animals { id } }`)).data).toEqual({ animals: [] });
  },
  animal: async (bob, ann) => {
    const res = await bob(`query ($id: ID!) { animal(id: $id) { id } }`, { id: ann.animalId });
    expect(res.data).toEqual({ animal: null });
  },
  // Creating your own records is allowed; the snapshot check below proves Ann's are untouched.
  createAnimal: async (bob) => {
    const res = await bob(
      `mutation { createAnimal(name: "Rex", species: "dog", category: PET) { id } }`,
    );
    expect(res.errors).toBeUndefined();
  },
  createFarm: async (bob) => {
    const res = await bob(
      `mutation { createFarm(input: { name: "Bob's other farm", postcode: "UB8 3PH" }) { id } }`,
    );
    expect(res.errors).toBeUndefined();
  },
  addLogEntry: async (bob, ann) => {
    const res = await bob(
      `mutation ($id: ID!) { addLogEntry(animalId: $id, date: "2026-06-01", type: "Tick check") { id } }`,
      { id: ann.animalId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  deleteLogEntry: async (bob, ann) => {
    const res = await bob(`mutation ($id: ID!) { deleteLogEntry(id: $id) }`, { id: ann.logId });
    expect(res.data).toEqual({ deleteLogEntry: false });
  },
  updateTask: async (bob, ann) => {
    const res = await bob(
      `mutation ($id: ID!) { updateTask(id: $id, input: { title: "Mine" }) { id } }`,
      { id: ann.taskId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  deleteTask: async (bob, ann) => {
    const res = await bob(`mutation ($id: ID!) { deleteTask(id: $id) }`, { id: ann.taskId });
    expect(res.data).toEqual({ deleteTask: false });
  },
  correctTreatment: async (bob, ann) => {
    const res = await bob(
      `mutation ($id: ID!) {
        correctTreatment(id: $id, input: { batchNumber: "X" }, reason: "Mine") { id }
      }`,
      { id: ann.treatmentId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  voidTreatment: async (bob, ann) => {
    const res = await bob(`mutation ($id: ID!) { voidTreatment(id: $id, reason: "x") { id } }`, {
      id: ann.treatmentId,
    });
    expect(code(res)).toBe('NOT_FOUND');
  },
  correctObservation: async (bob, ann) => {
    const res = await bob(
      `mutation ($id: ID!) {
        correctObservation(id: $id, input: { note: "X" }, reason: "Mine") { id }
      }`,
      { id: ann.observationId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  voidObservation: async (bob, ann) => {
    const res = await bob(`mutation ($id: ID!) { voidObservation(id: $id, reason: "x") { id } }`, {
      id: ann.observationId,
    });
    expect(code(res)).toBe('NOT_FOUND');
  },
  updateLogEntry: async (bob, ann) => {
    const res = await bob(
      `mutation ($id: ID!) { updateLogEntry(id: $id, input: { type: "Mine" }) { id } }`,
      { id: ann.logId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  updateAnimal: async (bob, ann) => {
    const res = await bob(
      `mutation ($id: ID!) { updateAnimal(id: $id, input: { name: "Mine" }) { id } }`,
      { id: ann.animalId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  deleteAnimal: async (bob, ann) => {
    const res = await bob(`mutation ($id: ID!) { deleteAnimal(id: $id) }`, { id: ann.animalId });
    expect(res.data).toEqual({ deleteAnimal: false });
  },
  createField: async (bob, ann) => {
    const res = await bob(
      `mutation ($farmId: ID!) { createField(input: { farmId: $farmId, name: "Sneaky" }) { id } }`,
      { farmId: ann.farmId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  createLivestockGroup: async (bob, ann, bobs) => {
    const create = `mutation ($farmId: ID!, $fieldId: ID) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Sneaky", species: SHEEP, livestockClass: EWES, headCount: 1,
        currentFieldId: $fieldId
      }) { id }
    }`;
    // On Ann's farm
    expect(code(await bob(create, { farmId: ann.farmId }))).toBe('NOT_FOUND');
    // On Bob's farm, but in Ann's field
    expect(code(await bob(create, { farmId: bobs.farmId, fieldId: ann.fieldId }))).toBe(
      'NOT_FOUND',
    );
  },
  updateLivestockGroup: async (bob, ann) => {
    const res = await bob(
      `mutation ($id: ID!) { updateLivestockGroup(id: $id, input: { headCount: 1 }) { id } }`,
      { id: ann.groupId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  livestockGroup: async (bob, ann) => {
    const res = await bob(`query ($id: ID!) { livestockGroup(id: $id) { id } }`, {
      id: ann.groupId,
    });
    expect(res.data).toEqual({ livestockGroup: null });
  },
  treatments: async (bob, ann) => {
    const res = await bob(
      `query ($farmId: ID!) { treatments(farmId: $farmId, from: "2026-01-01", to: "2026-12-31") { id } }`,
      { farmId: ann.farmId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  recordTreatment: async (bob, ann) => {
    const res = await bob(
      `mutation ($groupId: ID!) { recordTreatment(input: { ${TREATMENT_FIELDS} }) { id } }`,
      { groupId: ann.groupId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  recordObservation: async (bob, ann) => {
    const res = await bob(
      `mutation ($groupId: ID!) {
        recordObservation(input: { groupId: $groupId, date: "2026-06-01", type: "Check" }) { id }
      }`,
      { groupId: ann.groupId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  briefing: async (bob, ann) => {
    const res = await bob(`query ($farmId: ID!) { briefing(farmId: $farmId) { date } }`, {
      farmId: ann.farmId,
    });
    expect(res.data).toEqual({ briefing: null });
  },
  refreshBriefing: async (bob, ann) => {
    const res = await bob(`mutation ($farmId: ID!) { refreshBriefing(farmId: $farmId) { date } }`, {
      farmId: ann.farmId,
    });
    expect(code(res)).toBe('NOT_FOUND');
  },
  tasks: async (bob, ann) => {
    const res = await bob(`query ($farmId: ID!) { tasks(farmId: $farmId) { id } }`, {
      farmId: ann.farmId,
    });
    expect(code(res)).toBe('NOT_FOUND');
  },
  createTask: async (bob, ann) => {
    const res = await bob(
      `mutation ($groupId: ID!) {
        createTask(input: { groupId: $groupId, title: "Sneaky", dueDate: "2026-06-01" }) { id }
      }`,
      { groupId: ann.groupId },
    );
    expect(code(res)).toBe('NOT_FOUND');
    const farmWide = await bob(
      `mutation ($farmId: ID!) {
        createTask(input: { farmId: $farmId, title: "Sneaky", dueDate: "2026-06-01" }) { id }
      }`,
      { farmId: ann.farmId },
    );
    expect(code(farmWide)).toBe('NOT_FOUND');
  },
  setTaskDone: async (bob, ann) => {
    const res = await bob(`mutation ($id: ID!) { setTaskDone(id: $id, done: true) { id } }`, {
      id: ann.taskId,
    });
    expect(code(res)).toBe('NOT_FOUND');
  },
  briefingPreferences: async (bob, ann) => {
    const res = await bob(
      `query ($farmId: ID!) { briefingPreferences(farmId: $farmId) { sendAt } }`,
      { farmId: ann.farmId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  setBriefingPreferences: async (bob, ann) => {
    const res = await bob(
      `mutation ($farmId: ID!) {
        setBriefingPreferences(farmId: $farmId, input: {
          emailEnabled: false, sendAt: "05:00", alwaysSend: true
        }) { sendAt }
      }`,
      { farmId: ann.farmId },
    );
    expect(code(res)).toBe('NOT_FOUND');
  },
  moveLivestockGroup: async (bob, ann, bobs) => {
    const move = `mutation ($groupId: ID!, $fieldId: ID!) {
      moveLivestockGroup(input: { groupId: $groupId, toFieldId: $fieldId, movedOn: "2026-06-01" }) { id }
    }`;
    // Ann's group
    expect(code(await bob(move, { groupId: ann.groupId, fieldId: ann.otherFieldId }))).toBe(
      'NOT_FOUND',
    );
    // Bob's group into Ann's field
    expect(code(await bob(move, { groupId: bobs.groupId, fieldId: ann.fieldId }))).toBe(
      'NOT_FOUND',
    );
  },
};

// A minimal call to each protected operation, used to check it refuses anonymous users.
const ANONYMOUS_CALLS: Record<string, string> = {
  farms: `query { farms { id } }`,
  farm: `query { farm(id: "x") { id } }`,
  animals: `query { animals { id } }`,
  animal: `query { animal(id: "x") { id } }`,
  createAnimal: `mutation { createAnimal(name: "Rex", species: "dog", category: PET) { id } }`,
  createFarm: `mutation { createFarm(input: { name: "X", postcode: "UB8 3PH" }) { id } }`,
  addLogEntry: `mutation { addLogEntry(animalId: "x", date: "2026-06-01", type: "Check") { id } }`,
  deleteLogEntry: `mutation { deleteLogEntry(id: "x") }`,
  updateTask: `mutation { updateTask(id: "x", input: { title: "X" }) { id } }`,
  deleteTask: `mutation { deleteTask(id: "x") }`,
  correctTreatment: `mutation { correctTreatment(id: "x", input: {}, reason: "x") { id } }`,
  voidTreatment: `mutation { voidTreatment(id: "x", reason: "x") { id } }`,
  correctObservation: `mutation { correctObservation(id: "x", input: {}, reason: "x") { id } }`,
  voidObservation: `mutation { voidObservation(id: "x", reason: "x") { id } }`,
  updateLogEntry: `mutation { updateLogEntry(id: "x", input: { type: "X" }) { id } }`,
  updateAnimal: `mutation { updateAnimal(id: "x", input: { name: "X" }) { id } }`,
  deleteAnimal: `mutation { deleteAnimal(id: "x") }`,
  createField: `mutation { createField(input: { farmId: "x", name: "X" }) { id } }`,
  createLivestockGroup: `mutation { createLivestockGroup(input: {
    farmId: "x", name: "X", species: SHEEP, livestockClass: EWES, headCount: 1 }) { id } }`,
  updateLivestockGroup: `mutation { updateLivestockGroup(id: "x", input: { headCount: 1 }) { id } }`,
  livestockGroup: `query { livestockGroup(id: "x") { id } }`,
  treatments: `query { treatments(farmId: "x", from: "2026-01-01", to: "2026-12-31") { id } }`,
  recordTreatment: `mutation { recordTreatment(input: {
    groupId: "x", date: "2026-06-01", productName: "X", animalsTreated: 1,
    administeredBy: "X", meatWithdrawalDays: 0 }) { id } }`,
  recordObservation: `mutation { recordObservation(input: {
    groupId: "x", date: "2026-06-01", type: "Check" }) { id } }`,
  briefing: `query { briefing(farmId: "x") { date } }`,
  refreshBriefing: `mutation { refreshBriefing(farmId: "x") { date } }`,
  tasks: `query { tasks(farmId: "x") { id } }`,
  createTask: `mutation { createTask(input: { groupId: "x", title: "X", dueDate: "2026-06-01" }) { id } }`,
  setTaskDone: `mutation { setTaskDone(id: "x", done: true) { id } }`,
  briefingPreferences: `query { briefingPreferences(farmId: "x") { sendAt } }`,
  setBriefingPreferences: `mutation { setBriefingPreferences(farmId: "x", input: {
    emailEnabled: true, sendAt: "06:00", alwaysSend: false }) { sendAt } }`,
  moveLivestockGroup: `mutation { moveLivestockGroup(input: {
    groupId: "x", toFieldId: "y", movedOn: "2026-06-01" }) { id } }`,
};

const ANNS_DATA = /* GraphQL */ `
  query {
    farms {
      id
      name
      postcode
      fields {
        id
        name
      }
      groups {
        id
        name
        headCount
        currentField {
          id
        }
        movements {
          id
        }
        treatments {
          id
          batchNumber
          voided
        }
        observations {
          id
          note
          voided
        }
        withdrawal {
          inWithdrawal
        }
      }
    }
    animals {
      id
      name
      logs {
        id
      }
    }
  }
`;

async function setUpAnn(ann: Gql): Promise<AnnsData> {
  type Id = { id: string };
  const farm = await ann<{ createFarm: Id }>(
    `mutation { createFarm(input: { name: "Ann's farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const field = (name: string) =>
    ann<{ createField: Id }>(
      `mutation ($farmId: ID!, $name: String!) { createField(input: { farmId: $farmId, name: $name }) { id } }`,
      { farmId, name },
    );
  const fieldId = (await field('Top')).data!.createField.id;
  const otherFieldId = (await field('Lower')).data!.createField.id;
  const group = await ann<{ createLivestockGroup: Id }>(
    `mutation ($farmId: ID!, $fieldId: ID!) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Ewes", species: SHEEP, livestockClass: EWES, headCount: 80,
        currentFieldId: $fieldId
      }) { id }
    }`,
    { farmId, fieldId },
  );
  const groupId = group.data!.createLivestockGroup.id;
  const treatment = await ann<{ recordTreatment: Id }>(
    `mutation ($groupId: ID!) { recordTreatment(input: { ${TREATMENT_FIELDS} }) { id } }`,
    { groupId },
  );
  const observation = await ann<{ recordObservation: Id }>(
    `mutation ($groupId: ID!) {
      recordObservation(input: { groupId: $groupId, date: "2026-06-01", type: "Check" }) { id }
    }`,
    { groupId },
  );
  const task = await ann<{ createTask: Id }>(
    `mutation ($groupId: ID!) {
      createTask(input: { groupId: $groupId, title: "Check water", dueDate: "2026-06-01" }) { id }
    }`,
    { groupId },
  );
  const animal = await ann<{ createAnimal: Id }>(
    `mutation { createAnimal(name: "Bella", species: "dog", category: PET) { id } }`,
  );
  const animalId = animal.data!.createAnimal.id;
  const log = await ann<{ addLogEntry: Id }>(
    `mutation ($id: ID!) { addLogEntry(animalId: $id, date: "2026-05-01", type: "Tick check") { id } }`,
    { id: animalId },
  );
  return {
    farmId,
    fieldId,
    otherFieldId,
    groupId,
    taskId: task.data!.createTask.id,
    animalId,
    logId: log.data!.addLogEntry.id,
    treatmentId: treatment.data!.recordTreatment.id,
    observationId: observation.data!.recordObservation.id,
  };
}

async function setUpBob(bob: Gql): Promise<BobsData> {
  const farm = await bob<{ createFarm: { id: string } }>(
    `mutation { createFarm(input: { name: "Bob's farm", postcode: "UB8 3PH" }) { id } }`,
  );
  const farmId = farm.data!.createFarm.id;
  const group = await bob<{ createLivestockGroup: { id: string } }>(
    `mutation ($farmId: ID!) {
      createLivestockGroup(input: {
        farmId: $farmId, name: "Bob's flock", species: SHEEP, livestockClass: EWES, headCount: 10
      }) { id }
    }`,
    { farmId },
  );
  return { farmId, groupId: group.data!.createLivestockGroup.id };
}

function operationNames(): string[] {
  const schema = buildSchema(typeDefs);
  const fields = (type: GraphQLObjectType | null | undefined) =>
    Object.keys(type?.getFields() ?? {});
  return [...fields(schema.getQueryType()), ...fields(schema.getMutationType())];
}

describe('farm and owner scoping (FR-8.4)', () => {
  let ann: Gql;
  let bob: Gql;
  let annsData: AnnsData;
  let bobsData: BobsData;

  beforeEach(async () => {
    const t = buildTestApp();
    ann = await t.signedIn('ann@example.com');
    bob = await t.signedIn('bob@example.com');
    annsData = await setUpAnn(ann);
    bobsData = await setUpBob(bob);
  });

  it('covers every query and mutation in the schema', () => {
    // A new operation must be added to CROSS_USER (or PUBLIC) before this passes.
    const covered = new Set([...PUBLIC, ...Object.keys(CROSS_USER)]);
    expect(operationNames().filter((name) => !covered.has(name))).toEqual([]);
    expect(Object.keys(ANONYMOUS_CALLS).sort()).toEqual(Object.keys(CROSS_USER).sort());
  });

  /** Everything of Ann's that Bob might try to read or change. */
  const snapshot = async () => [
    await ann(ANNS_DATA),
    await ann(
      `query ($farmId: ID!) {
        tasks(farmId: $farmId) { id title done }
        briefingPreferences(farmId: $farmId) { emailEnabled sendAt alwaysSend }
      }`,
      { farmId: annsData.farmId },
    ),
  ];

  it.each(Object.keys(CROSS_USER))('%s: Bob can’t reach Ann’s data', async (operation) => {
    const before = await snapshot();
    await CROSS_USER[operation]!(bob, annsData, bobsData);
    expect(await snapshot()).toEqual(before);
  });

  it.each(Object.entries(ANONYMOUS_CALLS))(
    '%s: refuses anonymous users',
    async (_operation, query) => {
      const { gql } = buildTestApp();
      const res = await gql(query);
      expect(code(res)).toBe('UNAUTHENTICATED');
    },
  );

  it('still lets Ann see all her own data', async () => {
    const res = await ann<{
      farms: Array<{ groups: Array<{ movements: unknown[] }> }>;
      animals: Array<{ logs: unknown[] }>;
    }>(ANNS_DATA);
    expect(res.data!.farms).toHaveLength(1);
    expect(res.data!.farms[0]!.groups[0]!.movements).toHaveLength(1);
    expect(res.data!.animals[0]!.logs).toHaveLength(1);
  });
});

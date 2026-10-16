import { describe, expect, it } from 'vitest';
import { buildTestApp, fakeDays, fakeWeather } from './fakes';

const CREATE = /* GraphQL */ `
  mutation ($name: String!, $species: String!, $category: AnimalCategory!) {
    createAnimal(name: $name, species: $species, category: $category) {
      id
      name
      species
      category
    }
  }
`;

const ADD_LOG = /* GraphQL */ `
  mutation ($animalId: ID!, $date: String!, $type: String!, $note: String, $nextDueDate: String) {
    addLogEntry(
      animalId: $animalId
      date: $date
      type: $type
      note: $note
      nextDueDate: $nextDueDate
    ) {
      id
      date
      type
      note
      nextDueDate
    }
  }
`;

const LIST = /* GraphQL */ `
  query {
    animals {
      id
      name
      category
      logs {
        id
        date
        type
        nextDueDate
      }
    }
  }
`;

type Animal = {
  id: string;
  name: string;
  category: string;
  logs: Array<{ id: string; date: string }>;
};

describe('animals and logs', () => {
  it('creates an animal, adds logs (newest first) and deletes one', async () => {
    const gql = await buildTestApp().signedIn();

    const created = await gql<{ createAnimal: { id: string; category: string } }>(CREATE, {
      name: ' Bella ',
      species: 'dog',
      category: 'PET',
    });
    const id = created.data!.createAnimal.id;
    expect(created.data!.createAnimal).toMatchObject({ category: 'PET' });

    await gql(ADD_LOG, { animalId: id, date: '2026-05-01', type: 'Tick check' });
    const second = await gql<{ addLogEntry: { id: string; nextDueDate: string } }>(ADD_LOG, {
      animalId: id,
      date: '2026-06-01',
      type: 'Treatment given',
      note: 'Recorded by owner',
      nextDueDate: '2026-07-01',
    });
    expect(second.data!.addLogEntry.nextDueDate).toBe('2026-07-01');

    let list = await gql<{ animals: Animal[] }>(LIST);
    expect(list.data!.animals[0]!.name).toBe('Bella');
    expect(list.data!.animals[0]!.logs.map((l) => l.date)).toEqual(['2026-06-01', '2026-05-01']);

    const del = await gql<{ deleteLogEntry: boolean }>(
      `mutation ($id: ID!) { deleteLogEntry(id: $id) }`,
      {
        id: second.data!.addLogEntry.id,
      },
    );
    expect(del.data!.deleteLogEntry).toBe(true);

    list = await gql<{ animals: Animal[] }>(LIST);
    expect(list.data!.animals[0]!.logs).toHaveLength(1);
  });

  it('looks up a single animal by id, or returns null', async () => {
    const gql = await buildTestApp().signedIn();
    const created = await gql<{ createAnimal: { id: string } }>(CREATE, {
      name: 'North field flock',
      species: 'sheep',
      category: 'FARM',
    });
    const q = `query ($id: ID!) { animal(id: $id) { name category } }`;
    const found = await gql<{ animal: { name: string; category: string } | null }>(q, {
      id: created.data!.createAnimal.id,
    });
    expect(found.data!.animal).toEqual({ name: 'North field flock', category: 'FARM' });

    const missing = await gql<{ animal: null }>(q, { id: 'nope' });
    expect(missing.data!.animal).toBeNull();
  });

  it('rejects a log entry for an unknown animal', async () => {
    const gql = await buildTestApp().signedIn();
    const res = await gql(ADD_LOG, { animalId: 'missing', date: '2026-06-01', type: 'Tick check' });
    expect(res.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('rejects a blank name', async () => {
    const gql = await buildTestApp().signedIn();
    const res = await gql(CREATE, { name: '   ', species: 'dog', category: 'PET' });
    expect(res.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
  });
});

const CREATE_PET = /* GraphQL */ `
  mutation ($name: String!, $species: String!, $postcode: String, $habitat: Boolean) {
    createAnimal(
      name: $name
      species: $species
      category: PET
      postcode: $postcode
      highExposureHabitat: $habitat
    ) {
      id
      postcode
      highExposureHabitat
    }
  }
`;

const UPDATE_PET = /* GraphQL */ `
  mutation ($id: ID!, $input: UpdateAnimalInput!) {
    updateAnimal(id: $id, input: $input) {
      id
      name
      postcode
      highExposureHabitat
    }
  }
`;

const PET_FORECAST = /* GraphQL */ `
  query ($id: ID!) {
    animal(id: $id) {
      forecast {
        location {
          postcode
        }
        risks {
          riskId
          days {
            level
            reason
          }
        }
      }
    }
  }
`;

type PetForecast = {
  animal: {
    forecast: {
      location: { postcode: string };
      risks: Array<{ riskId: string; days: Array<{ level: string; reason: string }> }>;
    } | null;
  };
};

const UPDATE_LOG = /* GraphQL */ `
  mutation ($id: ID!, $input: UpdateLogEntryInput!) {
    updateLogEntry(id: $id, input: $input) {
      id
      date
      type
      note
      nextDueDate
    }
  }
`;

describe('pet profiles (FR-2.6)', () => {
  it('saves a normalised home postcode and the long-grass setting', async () => {
    const gql = await buildTestApp().signedIn();
    const res = await gql<{ createAnimal: { postcode: string; highExposureHabitat: boolean } }>(
      CREATE_PET,
      { name: 'Bella', species: 'dog', postcode: ' ub83ph ', habitat: true },
    );
    expect(res.data!.createAnimal).toMatchObject({
      postcode: 'UB8 3PH',
      highExposureHabitat: true,
    });
  });

  it('rejects an invalid or unknown postcode', async () => {
    const gql = await buildTestApp().signedIn();
    const bad = await gql(CREATE_PET, { name: 'Bella', species: 'dog', postcode: 'nope' });
    expect(bad.errors?.[0]?.extensions?.code).toBe('INVALID_POSTCODE');
    const unknown = await gql(CREATE_PET, { name: 'Bella', species: 'dog', postcode: 'SW1A 1AA' });
    expect(unknown.errors?.[0]?.extensions?.code).toBe('POSTCODE_NOT_FOUND');
  });

  it('updates a pet, and null clears the postcode', async () => {
    const gql = await buildTestApp().signedIn();
    const created = await gql<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Bella',
      species: 'dog',
      postcode: 'UB8 3PH',
    });
    const id = created.data!.createAnimal.id;

    const renamed = await gql<{ updateAnimal: Record<string, unknown> }>(UPDATE_PET, {
      id,
      input: { name: ' Belle ', highExposureHabitat: true },
    });
    expect(renamed.data!.updateAnimal).toMatchObject({
      name: 'Belle',
      postcode: 'UB8 3PH',
      highExposureHabitat: true,
    });

    const cleared = await gql<{ updateAnimal: { postcode: string | null } }>(UPDATE_PET, {
      id,
      input: { postcode: null },
    });
    expect(cleared.data!.updateAnimal.postcode).toBeNull();

    const blank = await gql(UPDATE_PET, { id, input: { name: ' ' } });
    expect(blank.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
  });

  it("shows each pet's own forecast: tick and heatstroke for dogs, tick only for cats", async () => {
    const gql = await buildTestApp().signedIn();
    const dog = await gql<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Bella',
      species: 'dog',
      postcode: 'UB8 3PH',
    });
    const cat = await gql<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Tom',
      species: 'cat',
      postcode: 'UB8 3PH',
    });

    const dogForecast = await gql<PetForecast>(PET_FORECAST, { id: dog.data!.createAnimal.id });
    expect(dogForecast.data!.animal.forecast!.location.postcode).toBe('UB8 3PH');
    expect(dogForecast.data!.animal.forecast!.risks.map((r) => r.riskId).sort()).toEqual([
      'dog-heatstroke',
      'tick',
    ]);

    const catForecast = await gql<PetForecast>(PET_FORECAST, { id: cat.data!.createAnimal.id });
    expect(catForecast.data!.animal.forecast!.risks.map((r) => r.riskId)).toEqual(['tick']);
  });

  it('raises tick risk for pets that walk in long grass or woodland', async () => {
    // Mild but not humid: Medium tick risk on its own
    const app = buildTestApp({
      weather: fakeWeather(fakeDays(14, { humidityMeanPct: 70 })).client,
    });
    const gql = await app.signedIn();
    const pet = await gql<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Bella',
      species: 'dog',
      postcode: 'UB8 3PH',
      habitat: true,
    });
    const res = await gql<PetForecast>(PET_FORECAST, { id: pet.data!.createAnimal.id });
    const tick = res.data!.animal.forecast!.risks.find((r) => r.riskId === 'tick')!;
    expect(tick.days[0]!.level).toBe('HIGH');
  });

  it('has no forecast without a postcode', async () => {
    const gql = await buildTestApp().signedIn();
    const pet = await gql<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Bella',
      species: 'dog',
    });
    const res = await gql<PetForecast>(PET_FORECAST, { id: pet.data!.createAnimal.id });
    expect(res.data!.animal.forecast).toBeNull();
  });

  it('deletes a pet', async () => {
    const gql = await buildTestApp().signedIn();
    const pet = await gql<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Bella',
      species: 'dog',
    });
    const del = `mutation ($id: ID!) { deleteAnimal(id: $id) }`;
    const res = await gql<{ deleteAnimal: boolean }>(del, { id: pet.data!.createAnimal.id });
    expect(res.data!.deleteAnimal).toBe(true);
    expect((await gql<{ animals: unknown[] }>(LIST)).data!.animals).toEqual([]);
  });

  it("can't change or delete someone else's pet or log", async () => {
    const app = buildTestApp();
    const ann = await app.signedIn('ann@example.com');
    const bob = await app.signedIn('bob@example.com');
    const pet = await ann<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Bella',
      species: 'dog',
    });
    const id = pet.data!.createAnimal.id;
    const log = await ann<{ addLogEntry: { id: string } }>(ADD_LOG, {
      animalId: id,
      date: '2026-05-01',
      type: 'Tick check',
    });

    const update = await bob(UPDATE_PET, { id, input: { name: 'Mine' } });
    expect(update.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    const del = await bob<{ deleteAnimal: boolean }>(
      `mutation ($id: ID!) { deleteAnimal(id: $id) }`,
      {
        id,
      },
    );
    expect(del.data!.deleteAnimal).toBe(false);
    const editLog = await bob(UPDATE_LOG, { id: log.data!.addLogEntry.id, input: { type: 'x' } });
    expect(editLog.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});

describe('editing log entries', () => {
  async function petWithLog() {
    const gql = await buildTestApp().signedIn();
    const pet = await gql<{ createAnimal: { id: string } }>(CREATE_PET, {
      name: 'Bella',
      species: 'dog',
    });
    const log = await gql<{ addLogEntry: { id: string } }>(ADD_LOG, {
      animalId: pet.data!.createAnimal.id,
      date: '2026-05-01',
      type: 'Tick check',
      note: 'Clear',
      nextDueDate: '2026-05-08',
    });
    return { gql, logId: log.data!.addLogEntry.id };
  }

  it('changes only the given fields, and null clears the next due date', async () => {
    const { gql, logId } = await petWithLog();
    const res = await gql<{ updateLogEntry: Record<string, unknown> }>(UPDATE_LOG, {
      id: logId,
      input: { type: ' Tick check (done) ', nextDueDate: null },
    });
    expect(res.data!.updateLogEntry).toEqual({
      id: logId,
      date: '2026-05-01',
      type: 'Tick check (done)',
      note: 'Clear',
      nextDueDate: null,
    });
  });

  it('rejects bad dates, a due date before the entry, and a blank type', async () => {
    const { gql, logId } = await petWithLog();
    for (const input of [{ date: '1 May' }, { nextDueDate: '2026-04-30' }, { type: '  ' }]) {
      const res = await gql(UPDATE_LOG, { id: logId, input });
      expect(res.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
    }
  });

  it('validates new entries in the same way', async () => {
    const { gql } = await petWithLog();
    const pet = await gql<{ animals: Array<{ id: string }> }>(LIST);
    const res = await gql(ADD_LOG, {
      animalId: pet.data!.animals[0]!.id,
      date: '2026-06-01',
      type: 'Tick check',
      nextDueDate: '2026-05-01',
    });
    expect(res.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
  });
});

import { describe, expect, it } from 'vitest';
import { buildTestApp } from './fakes';

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
    const { gql } = buildTestApp();

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
    const { gql } = buildTestApp();
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
    const { gql } = buildTestApp();
    const res = await gql(ADD_LOG, { animalId: 'missing', date: '2026-06-01', type: 'Tick check' });
    expect(res.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('rejects a blank name', async () => {
    const { gql } = buildTestApp();
    const res = await gql(CREATE, { name: '   ', species: 'dog', category: 'PET' });
    expect(res.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
  });
});

import { describe, expect, it } from 'vitest';
import type { Animal, AnimalRepository } from '../src/repositories/animalRepository';

export interface AnimalRepositoryFixture {
  repo: AnimalRepository;
  /** A user id that animals can belong to. */
  newOwnerId(): Promise<string>;
}

const bella = (ownerId: string): Omit<Animal, 'id'> => ({
  ownerId,
  name: 'Bella',
  species: 'dog',
  category: 'pet',
  postcode: null,
  highExposureHabitat: false,
});

/** Behaviour every AnimalRepository must have, run against the in-memory fake and Postgres. */
export function animalRepositoryContract(setup: () => Promise<AnimalRepositoryFixture>) {
  describe('animals', () => {
    it('creates, lists per owner and gets an animal', async () => {
      const { repo, newOwnerId } = await setup();
      const owner = await newOwnerId();
      const other = await newOwnerId();
      const created = await repo.createAnimal({
        ...bella(owner),
        postcode: 'UB8 3PH',
        highExposureHabitat: true,
      });
      await repo.createAnimal({ ...bella(other), name: 'Tom', species: 'cat' });

      expect(created).toMatchObject({
        name: 'Bella',
        postcode: 'UB8 3PH',
        highExposureHabitat: true,
      });
      expect(await repo.getAnimal(created.id)).toEqual(created);
      expect((await repo.listAnimals(owner)).map((a) => a.name)).toEqual(['Bella']);
    });

    it('lists animals in the order they were added', async () => {
      const { repo, newOwnerId } = await setup();
      const owner = await newOwnerId();
      await repo.createAnimal({ ...bella(owner), name: 'Rex' });
      await repo.createAnimal({ ...bella(owner), name: 'Ace' });
      expect((await repo.listAnimals(owner)).map((a) => a.name)).toEqual(['Rex', 'Ace']);
    });

    it('updates only the given details', async () => {
      const { repo, newOwnerId } = await setup();
      const animal = await repo.createAnimal(bella(await newOwnerId()));
      const updated = await repo.updateAnimal(animal.id, { postcode: 'SW1A 1AA', name: 'Bel' });
      expect(updated).toEqual({ ...animal, postcode: 'SW1A 1AA', name: 'Bel' });
      expect(await repo.getAnimal(animal.id)).toEqual(updated);
    });

    it('deletes an animal together with its log', async () => {
      const { repo, newOwnerId } = await setup();
      const animal = await repo.createAnimal(bella(await newOwnerId()));
      const log = await repo.addLog({
        animalId: animal.id,
        date: '2026-06-01',
        type: 'Tick check',
      });

      expect(await repo.deleteAnimal(animal.id)).toBe(true);
      expect(await repo.getAnimal(animal.id)).toBeNull();
      expect(await repo.getLog(log.id)).toBeNull();
      expect(await repo.deleteAnimal(animal.id)).toBe(false);
    });

    it('treats unknown or malformed ids as not found', async () => {
      const { repo } = await setup();
      expect(await repo.getAnimal('not-an-id')).toBeNull();
      expect(await repo.getAnimal('00000000-0000-4000-8000-000000000000')).toBeNull();
      expect(await repo.updateAnimal('not-an-id', { name: 'x' })).toBeNull();
      expect(await repo.deleteAnimal('not-an-id')).toBe(false);
      expect(await repo.getLog('not-an-id')).toBeNull();
      expect(await repo.updateLog('not-an-id', { type: 'x' })).toBeNull();
      expect(await repo.deleteLog('not-an-id')).toBe(false);
      expect(await repo.listLogs('not-an-id')).toEqual([]);
    });
  });

  describe('logs', () => {
    it('adds logs and lists them newest first, latest added first on the same day', async () => {
      const { repo, newOwnerId } = await setup();
      const animal = await repo.createAnimal(bella(await newOwnerId()));
      await repo.addLog({ animalId: animal.id, date: '2026-05-01', type: 'Tick check' });
      await repo.addLog({ animalId: animal.id, date: '2026-06-01', type: 'Groomed' });
      const last = await repo.addLog({
        animalId: animal.id,
        date: '2026-06-01',
        type: 'Treatment given',
        note: 'By owner',
        nextDueDate: '2026-07-01',
      });

      expect(last).toMatchObject({ note: 'By owner', nextDueDate: '2026-07-01' });
      expect((await repo.listLogs(animal.id)).map((l) => l.type)).toEqual([
        'Treatment given',
        'Groomed',
        'Tick check',
      ]);
    });

    it('updates a log, clearing fields set to null', async () => {
      const { repo, newOwnerId } = await setup();
      const animal = await repo.createAnimal(bella(await newOwnerId()));
      const log = await repo.addLog({
        animalId: animal.id,
        date: '2026-06-01',
        type: 'Tick check',
        note: 'Found one',
        nextDueDate: '2026-06-08',
      });
      const updated = await repo.updateLog(log.id, { nextDueDate: null, date: '2026-06-02' });
      expect(updated).toEqual({ ...log, nextDueDate: null, date: '2026-06-02' });
      expect(await repo.getLog(log.id)).toEqual(updated);
    });

    it('deletes a log', async () => {
      const { repo, newOwnerId } = await setup();
      const animal = await repo.createAnimal(bella(await newOwnerId()));
      const log = await repo.addLog({
        animalId: animal.id,
        date: '2026-06-01',
        type: 'Tick check',
      });
      expect(await repo.deleteLog(log.id)).toBe(true);
      expect(await repo.listLogs(animal.id)).toEqual([]);
      expect(await repo.deleteLog(log.id)).toBe(false);
    });
  });
}

import { describe, expect, it } from 'vitest';
import type {
  KeepingRepository,
  NewContact,
  NewTaggedAnimal,
} from '../src/repositories/keepingRepository';

export interface KeepingFixture {
  repo: KeepingRepository;
  /** A farm and a user who owns it (real rows in Postgres). */
  newFarm(): Promise<{ farmId: string; userId: string }>;
}

export const contactInput = (overrides: Partial<NewContact> = {}): NewContact => ({
  farmId: null,
  ownerId: null,
  kind: 'VET',
  name: 'Dale Vets',
  phone: '01539 000000',
  emergencyPhone: null,
  email: null,
  website: null,
  address: null,
  notes: null,
  ...overrides,
});

export const taggedInput = (
  farmId: string,
  overrides: Partial<NewTaggedAnimal> = {},
): NewTaggedAnimal => ({
  farmId,
  groupId: null,
  tag: 'UK 1',
  name: null,
  species: 'SHEEP',
  sex: 'FEMALE',
  breed: null,
  dateOfBirth: '2024-03-01',
  status: 'ON_FARM',
  statusDate: null,
  notes: null,
  ...overrides,
});

/** Behaviour every KeepingRepository must have (v4), run against the in-memory fake and Postgres. */
export function keepingRepositoryContract(setup: () => Promise<KeepingFixture>) {
  describe('contacts', () => {
    it('adds, gets and lists contacts for a farm, by name', async () => {
      const { repo, newFarm } = await setup();
      const { farmId } = await newFarm();
      const other = await newFarm();
      const b = await repo.addContact(contactInput({ farmId, name: 'Bale Feeds', kind: 'FEED' }));
      await repo.addContact(contactInput({ farmId, name: 'Avon Vets' }));
      await repo.addContact(contactInput({ farmId: other.farmId, name: 'Elsewhere' }));
      expect(b).toMatchObject({ farmId, ownerId: null, name: 'Bale Feeds', kind: 'FEED' });
      expect(await repo.getContact(b.id)).toEqual(b);
      expect((await repo.listContacts({ farmIds: [farmId] })).map((c) => c.name)).toEqual([
        'Avon Vets',
        'Bale Feeds',
      ]);
    });

    it('lists personal contacts by owner, and several farms at once', async () => {
      const { repo, newFarm } = await setup();
      const a = await newFarm();
      const b = await newFarm();
      await repo.addContact(contactInput({ farmId: a.farmId, name: 'A' }));
      await repo.addContact(contactInput({ farmId: b.farmId, name: 'B' }));
      await repo.addContact(contactInput({ ownerId: a.userId, name: 'Mine' }));
      expect((await repo.listContacts({ ownerId: a.userId })).map((c) => c.name)).toEqual(['Mine']);
      expect(
        (await repo.listContacts({ farmIds: [a.farmId, b.farmId] })).map((c) => c.name),
      ).toEqual(['A', 'B']);
      expect(await repo.listContacts({ farmIds: [] })).toEqual([]);
    });

    it('updates only what is given, and deletes', async () => {
      const { repo, newFarm } = await setup();
      const { farmId } = await newFarm();
      const c = await repo.addContact(contactInput({ farmId }));
      const updated = await repo.updateContact(c.id, {
        notes: 'Out of hours via main line',
        phone: null,
      });
      expect(updated).toEqual({ ...c, notes: 'Out of hours via main line', phone: null });
      expect(await repo.deleteContact(c.id)).toBe(true);
      expect(await repo.getContact(c.id)).toBeNull();
      expect(await repo.deleteContact(c.id)).toBe(false);
    });

    it('treats unknown or malformed ids as not found', async () => {
      const { repo } = await setup();
      expect(await repo.getContact('nope')).toBeNull();
      expect(await repo.updateContact('nope', { name: 'x' })).toBeNull();
      expect(await repo.deleteContact('00000000-0000-4000-8000-000000000000')).toBe(false);
      expect(await repo.listContacts({ ownerId: 'nope' })).toEqual([]);
    });
  });

  describe('tagged animals', () => {
    it('adds, gets and lists a farm’s animals by tag', async () => {
      const { repo, newFarm } = await setup();
      const { farmId } = await newFarm();
      const other = await newFarm();
      const b = await repo.addTagged(taggedInput(farmId, { tag: 'UK 2' }));
      await repo.addTagged(taggedInput(farmId, { tag: 'UK 10' }));
      await repo.addTagged(taggedInput(other.farmId, { tag: 'UK 1' }));
      expect(await repo.getTagged(b.id)).toEqual(b);
      expect((await repo.listTagged(farmId)).map((a) => a.tag)).toEqual(['UK 2', 'UK 10']);
    });

    it('finds an animal by tag on a farm, ignoring case and spaces', async () => {
      const { repo, newFarm } = await setup();
      const { farmId } = await newFarm();
      const a = await repo.addTagged(taggedInput(farmId, { tag: 'UK 123 456' }));
      expect(await repo.findTaggedByTag(farmId, 'uk123456')).toEqual(a);
      expect(await repo.findTaggedByTag(farmId, 'UK 9')).toBeNull();
    });

    it('updates and deletes, and treats malformed ids as not found', async () => {
      const { repo, newFarm } = await setup();
      const { farmId } = await newFarm();
      const a = await repo.addTagged(taggedInput(farmId));
      const sold = await repo.updateTagged(a.id, { status: 'SOLD', statusDate: '2026-05-01' });
      expect(sold).toEqual({ ...a, status: 'SOLD', statusDate: '2026-05-01' });
      expect(await repo.deleteTagged(a.id)).toBe(true);
      expect(await repo.getTagged(a.id)).toBeNull();
      expect(await repo.getTagged('nope')).toBeNull();
      expect(await repo.updateTagged('nope', { name: 'x' })).toBeNull();
      expect(await repo.listTagged('nope')).toEqual([]);
    });
  });
}

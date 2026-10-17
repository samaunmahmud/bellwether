import { randomUUID } from 'node:crypto';
import { byTag, tagKey, type Contact, type TaggedAnimal } from '../domain/keeping';
import { definedOnly } from './animalRepository';

export type NewContact = Omit<Contact, 'id'>;
export type ContactPatch = Partial<Omit<Contact, 'id' | 'farmId' | 'ownerId'>>;
export type NewTaggedAnimal = Omit<TaggedAnimal, 'id'>;
export type TaggedPatch = Partial<Omit<TaggedAnimal, 'id' | 'farmId'>>;

/** Whose contacts to list: a user's own, or those of some farms. */
export type ContactScope = { ownerId: string } | { farmIds: string[] };

export const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' });

/**
 * v4 storage for what a keeper keeps beside the records: contacts (and, later, tagged animals,
 * documents and cameras). Unknown or malformed ids mean "not found".
 */
export interface KeepingRepository {
  addContact(input: NewContact): Promise<Contact>;
  getContact(id: string): Promise<Contact | null>;
  /** By name */
  listContacts(scope: ContactScope): Promise<Contact[]>;
  updateContact(id: string, patch: ContactPatch): Promise<Contact | null>;
  deleteContact(id: string): Promise<boolean>;

  addTagged(input: NewTaggedAnimal): Promise<TaggedAnimal>;
  getTagged(id: string): Promise<TaggedAnimal | null>;
  /** By tag, in natural order */
  listTagged(farmId: string): Promise<TaggedAnimal[]>;
  /** Matches ignoring case and spaces */
  findTaggedByTag(farmId: string, tag: string): Promise<TaggedAnimal | null>;
  updateTagged(id: string, patch: TaggedPatch): Promise<TaggedAnimal | null>;
  deleteTagged(id: string): Promise<boolean>;
}

export class InMemoryKeepingRepository implements KeepingRepository {
  private contacts = new Map<string, Contact>();
  private tagged = new Map<string, TaggedAnimal>();

  constructor(private newId: () => string = randomUUID) {}

  async addContact(input: NewContact) {
    const contact = { ...input, id: this.newId() };
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async getContact(id: string) {
    return this.contacts.get(id) ?? null;
  }

  async listContacts(scope: ContactScope) {
    return [...this.contacts.values()]
      .filter((c) =>
        'ownerId' in scope
          ? c.ownerId === scope.ownerId
          : c.farmId !== null && scope.farmIds.includes(c.farmId),
      )
      .sort(byName);
  }

  async updateContact(id: string, patch: ContactPatch) {
    const contact = this.contacts.get(id);
    if (!contact) return null;
    const updated = { ...contact, ...definedOnly(patch) };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string) {
    return this.contacts.delete(id);
  }

  async addTagged(input: NewTaggedAnimal) {
    const animal = { ...input, id: this.newId() };
    this.tagged.set(animal.id, animal);
    return animal;
  }

  async getTagged(id: string) {
    return this.tagged.get(id) ?? null;
  }

  async listTagged(farmId: string) {
    return [...this.tagged.values()].filter((a) => a.farmId === farmId).sort(byTag);
  }

  async findTaggedByTag(farmId: string, tag: string) {
    const key = tagKey(tag);
    return (
      [...this.tagged.values()].find((a) => a.farmId === farmId && tagKey(a.tag) === key) ?? null
    );
  }

  async updateTagged(id: string, patch: TaggedPatch) {
    const animal = this.tagged.get(id);
    if (!animal) return null;
    const updated = { ...animal, ...definedOnly(patch) };
    this.tagged.set(id, updated);
    return updated;
  }

  async deleteTagged(id: string) {
    return this.tagged.delete(id);
  }
}

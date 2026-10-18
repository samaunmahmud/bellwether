import { randomUUID } from 'node:crypto';
import {
  byNewestUpload,
  byTag,
  tagKey,
  type Camera,
  type Contact,
  type StoredDocument,
  type TaggedAnimal,
} from '../domain/keeping';
import { definedOnly } from './animalRepository';

export type NewContact = Omit<Contact, 'id'>;
export type ContactPatch = Partial<Omit<Contact, 'id' | 'farmId' | 'ownerId'>>;
export type NewTaggedAnimal = Omit<TaggedAnimal, 'id'>;
export type TaggedPatch = Partial<Omit<TaggedAnimal, 'id' | 'farmId'>>;
export type NewDocument = Omit<StoredDocument, 'id'>;
export type DocumentPatch = Partial<
  Pick<StoredDocument, 'kind' | 'title' | 'documentDate' | 'expiresOn' | 'notes'>
>;

export type NewCamera = Omit<Camera, 'id'>;
export type CameraPatch = Partial<Omit<Camera, 'id' | 'farmId'>>;

/** Whose documents to list: a farm's or a pet's. */
export type DocumentScope = { farmId: string } | { petId: string };

/** Whose contacts to list: a user's own, or those of some farms. */
export type ContactScope = { ownerId: string } | { farmIds: string[] };

export const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' });

/**
 * v4 storage for what a keeper keeps beside the records: contacts, tagged animals, documents and camera links. Unknown or malformed ids mean "not found".
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

  /** Stores the details and the file's bytes together. */
  addDocument(input: NewDocument, content: Uint8Array): Promise<StoredDocument>;
  getDocument(id: string): Promise<StoredDocument | null>;
  /** The file itself, kept apart so lists stay light */
  getDocumentContent(id: string): Promise<Uint8Array | null>;
  /** Newest upload first */
  listDocuments(scope: DocumentScope): Promise<StoredDocument[]>;
  updateDocument(id: string, patch: DocumentPatch): Promise<StoredDocument | null>;
  /** Deletes the file too */
  deleteDocument(id: string): Promise<boolean>;

  addCamera(input: NewCamera): Promise<Camera>;
  getCamera(id: string): Promise<Camera | null>;
  /** By name */
  listCameras(farmId: string): Promise<Camera[]>;
  updateCamera(id: string, patch: CameraPatch): Promise<Camera | null>;
  deleteCamera(id: string): Promise<boolean>;
}

export class InMemoryKeepingRepository implements KeepingRepository {
  private contacts = new Map<string, Contact>();
  private tagged = new Map<string, TaggedAnimal>();
  private cameras = new Map<string, Camera>();
  private documents = new Map<string, { doc: StoredDocument; content: Uint8Array }>();

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

  async addDocument(input: NewDocument, content: Uint8Array) {
    const doc = { ...input, id: this.newId() };
    this.documents.set(doc.id, { doc, content: Uint8Array.from(content) });
    return doc;
  }

  async getDocument(id: string) {
    return this.documents.get(id)?.doc ?? null;
  }

  async getDocumentContent(id: string) {
    return this.documents.get(id)?.content ?? null;
  }

  async listDocuments(scope: DocumentScope) {
    return [...this.documents.values()]
      .map((d) => d.doc)
      .filter((d) => ('farmId' in scope ? d.farmId === scope.farmId : d.petId === scope.petId))
      .sort(byNewestUpload);
  }

  async updateDocument(id: string, patch: DocumentPatch) {
    const stored = this.documents.get(id);
    if (!stored) return null;
    const doc = { ...stored.doc, ...definedOnly(patch) };
    this.documents.set(id, { ...stored, doc });
    return doc;
  }

  async deleteDocument(id: string) {
    return this.documents.delete(id);
  }

  async addCamera(input: NewCamera) {
    const camera = { ...input, id: this.newId() };
    this.cameras.set(camera.id, camera);
    return camera;
  }

  async getCamera(id: string) {
    return this.cameras.get(id) ?? null;
  }

  async listCameras(farmId: string) {
    return [...this.cameras.values()].filter((c) => c.farmId === farmId).sort(byName);
  }

  async updateCamera(id: string, patch: CameraPatch) {
    const camera = this.cameras.get(id);
    if (!camera) return null;
    const updated = { ...camera, ...definedOnly(patch) };
    this.cameras.set(id, updated);
    return updated;
  }

  async deleteCamera(id: string) {
    return this.cameras.delete(id);
  }
}

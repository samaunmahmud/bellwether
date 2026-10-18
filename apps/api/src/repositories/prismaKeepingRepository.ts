import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import {
  byNewestUpload,
  byTag,
  tagKey,
  type AnimalSex,
  type AnimalStatus,
  type Camera,
  type Contact,
  type DocumentKind,
  type DocumentMimeType,
  type StoredDocument,
  type TaggedAnimal,
  type TaggedSpecies,
} from '../domain/keeping';
import { definedOnly } from './animalRepository';
import {
  byName,
  type CameraPatch,
  type ContactPatch,
  type ContactScope,
  type DocumentPatch,
  type DocumentScope,
  type KeepingRepository,
  type NewCamera,
  type NewContact,
  type NewDocument,
  type NewTaggedAnimal,
  type TaggedPatch,
} from './keepingRepository';

const toDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toDbOrNull = (iso: string | null | undefined) =>
  iso === undefined ? undefined : iso === null ? null : toDb(iso);
const fromDb = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const taggedSelect = {
  id: true,
  farmId: true,
  groupId: true,
  tag: true,
  name: true,
  species: true,
  sex: true,
  breed: true,
  dateOfBirth: true,
  status: true,
  statusDate: true,
  notes: true,
} as const;

type TaggedRow = Omit<TaggedAnimal, 'dateOfBirth' | 'statusDate' | 'species' | 'sex' | 'status'> & {
  species: string;
  sex: string;
  status: string;
  dateOfBirth: Date | null;
  statusDate: Date | null;
};

const toTagged = (row: TaggedRow): TaggedAnimal => ({
  ...row,
  species: row.species as TaggedSpecies,
  sex: row.sex as AnimalSex,
  status: row.status as AnimalStatus,
  dateOfBirth: fromDb(row.dateOfBirth),
  statusDate: fromDb(row.statusDate),
});

function taggedData(patch: TaggedPatch) {
  return definedOnly({
    ...patch,
    tagKey: patch.tag === undefined ? undefined : tagKey(patch.tag),
    dateOfBirth: toDbOrNull(patch.dateOfBirth),
    statusDate: toDbOrNull(patch.statusDate),
  });
}

const contactSelect = {
  id: true,
  farmId: true,
  ownerId: true,
  kind: true,
  name: true,
  phone: true,
  emergencyPhone: true,
  email: true,
  website: true,
  address: true,
  notes: true,
} as const;

const documentSelect = {
  id: true,
  farmId: true,
  petId: true,
  groupId: true,
  taggedAnimalId: true,
  kind: true,
  title: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  documentDate: true,
  expiresOn: true,
  notes: true,
  uploadedById: true,
  uploadedAt: true,
} as const;

type DocumentRow = Omit<
  StoredDocument,
  'kind' | 'mimeType' | 'documentDate' | 'expiresOn' | 'uploadedAt'
> & {
  kind: string;
  mimeType: string;
  documentDate: Date | null;
  expiresOn: Date | null;
  uploadedAt: Date;
};

const toDocument = (row: DocumentRow): StoredDocument => ({
  ...row,
  kind: row.kind as DocumentKind,
  mimeType: row.mimeType as DocumentMimeType,
  documentDate: fromDb(row.documentDate),
  expiresOn: fromDb(row.expiresOn),
  uploadedAt: row.uploadedAt.toISOString(),
});

const documentData = (patch: DocumentPatch) =>
  definedOnly({
    ...patch,
    documentDate: toDbOrNull(patch.documentDate),
    expiresOn: toDbOrNull(patch.expiresOn),
  });

const cameraSelect = {
  id: true,
  farmId: true,
  name: true,
  url: true,
  fieldId: true,
  groupId: true,
  notes: true,
} as const;

/** Postgres-backed KeepingRepository (v4). Shares its contract tests with the in-memory fake. */
export class PrismaKeepingRepository implements KeepingRepository {
  constructor(private db: PrismaClient) {}

  async addContact(input: NewContact): Promise<Contact> {
    return this.db.contact.create({ data: input, select: contactSelect });
  }

  async getContact(id: string) {
    if (!isUuid(id)) return null;
    return this.db.contact.findUnique({ where: { id }, select: contactSelect });
  }

  async listContacts(scope: ContactScope) {
    const where =
      'ownerId' in scope
        ? isUuid(scope.ownerId)
          ? { ownerId: scope.ownerId }
          : null
        : { farmId: { in: scope.farmIds.filter(isUuid) } };
    if (!where) return [];
    return (await this.db.contact.findMany({ where, select: contactSelect })).sort(byName);
  }

  async updateContact(id: string, patch: ContactPatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.contact.updateMany({ where: { id }, data: definedOnly(patch) });
    return count ? this.getContact(id) : null;
  }

  async deleteContact(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.contact.deleteMany({ where: { id } });
    return count > 0;
  }

  async addTagged(input: NewTaggedAnimal) {
    const row = await this.db.taggedAnimal.create({
      data: { ...input, ...taggedData(input), tagKey: tagKey(input.tag) } as never,
      select: taggedSelect,
    });
    return toTagged(row);
  }

  async getTagged(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.taggedAnimal.findUnique({ where: { id }, select: taggedSelect });
    return row ? toTagged(row) : null;
  }

  async listTagged(farmId: string) {
    if (!isUuid(farmId)) return [];
    const rows = await this.db.taggedAnimal.findMany({ where: { farmId }, select: taggedSelect });
    return rows.map(toTagged).sort(byTag);
  }

  async findTaggedByTag(farmId: string, tag: string) {
    if (!isUuid(farmId)) return null;
    const row = await this.db.taggedAnimal.findUnique({
      where: { farmId_tagKey: { farmId, tagKey: tagKey(tag) } },
      select: taggedSelect,
    });
    return row ? toTagged(row) : null;
  }

  async updateTagged(id: string, patch: TaggedPatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.taggedAnimal.updateMany({
      where: { id },
      data: taggedData(patch) as never,
    });
    return count ? this.getTagged(id) : null;
  }

  async deleteTagged(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.taggedAnimal.deleteMany({ where: { id } });
    return count > 0;
  }

  async addDocument(input: NewDocument, content: Uint8Array) {
    const row = await this.db.document.create({
      data: {
        ...input,
        ...documentData(input),
        uploadedAt: new Date(input.uploadedAt),
        file: { create: { content: Uint8Array.from(content) } },
      } as never,
      select: documentSelect,
    });
    return toDocument(row);
  }

  async getDocument(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.document.findUnique({ where: { id }, select: documentSelect });
    return row ? toDocument(row) : null;
  }

  async getDocumentContent(id: string) {
    if (!isUuid(id)) return null;
    const file = await this.db.documentFile.findUnique({ where: { documentId: id } });
    return file ? Uint8Array.from(file.content) : null;
  }

  async listDocuments(scope: DocumentScope) {
    const where = 'farmId' in scope ? { farmId: scope.farmId } : { petId: scope.petId };
    if (!isUuid(Object.values(where)[0]!)) return [];
    const rows = await this.db.document.findMany({ where, select: documentSelect });
    return rows.map(toDocument).sort(byNewestUpload);
  }

  async updateDocument(id: string, patch: DocumentPatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.document.updateMany({
      where: { id },
      data: documentData(patch) as never,
    });
    return count ? this.getDocument(id) : null;
  }

  async deleteDocument(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.document.deleteMany({ where: { id } });
    return count > 0;
  }

  async addCamera(input: NewCamera): Promise<Camera> {
    return this.db.camera.create({ data: input, select: cameraSelect });
  }

  async getCamera(id: string) {
    if (!isUuid(id)) return null;
    return this.db.camera.findUnique({ where: { id }, select: cameraSelect });
  }

  async listCameras(farmId: string) {
    if (!isUuid(farmId)) return [];
    return (await this.db.camera.findMany({ where: { farmId }, select: cameraSelect })).sort(
      byName,
    );
  }

  async updateCamera(id: string, patch: CameraPatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.camera.updateMany({ where: { id }, data: definedOnly(patch) });
    return count ? this.getCamera(id) : null;
  }

  async deleteCamera(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.camera.deleteMany({ where: { id } });
    return count > 0;
  }
}

import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import {
  byTag,
  tagKey,
  type AnimalSex,
  type AnimalStatus,
  type Contact,
  type TaggedAnimal,
  type TaggedSpecies,
} from '../domain/keeping';
import { definedOnly } from './animalRepository';
import {
  byName,
  type ContactPatch,
  type ContactScope,
  type KeepingRepository,
  type NewContact,
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
}

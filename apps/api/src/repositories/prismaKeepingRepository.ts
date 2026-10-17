import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import type { Contact } from '../domain/keeping';
import { definedOnly } from './animalRepository';
import {
  byName,
  type ContactPatch,
  type ContactScope,
  type KeepingRepository,
  type NewContact,
} from './keepingRepository';

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
}

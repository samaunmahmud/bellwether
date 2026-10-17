import type { Contact, ContactKind } from '../domain/keeping';
import { appError } from '../errors';
import type { ContactPatch, KeepingRepository } from '../repositories/keepingRepository';
import type { FarmService } from './farmService';

export interface KeepingDeps {
  keeping: KeepingRepository;
  farmService: FarmService;
}

export interface ContactInput {
  /** Omit for a personal contact */
  farmId?: string | null;
  kind: ContactKind;
  name: string;
  phone?: string | null;
  emergencyPhone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
}

const MAX_TEXT = 500;

const clean = (v: string | null | undefined) => {
  const t = v?.trim();
  if (t && t.length > MAX_TEXT)
    throw appError('BAD_INPUT', `Keep each detail under ${MAX_TEXT} characters`);
  return t ? t : null;
};

function checkedPhone(raw: string | null | undefined, label: string) {
  const phone = clean(raw);
  if (phone && !(/^\+?[\d\s().-]+$/.test(phone) && (phone.match(/\d/g)?.length ?? 0) >= 3))
    throw appError('BAD_INPUT', `${label} should be a phone number, e.g. 01539 000000`);
  return phone;
}

/** Adds https:// to a bare address and refuses anything that isn't a web page (e.g. javascript:). */
export function checkedWebsite(raw: string | null | undefined) {
  const text = clean(raw);
  if (!text) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.'))
      return url.toString().replace(/\/$/, '');
  } catch {
    // falls through to the error below
  }
  throw appError('BAD_INPUT', 'Website should be a web address, e.g. example.com');
}

function checkedContact(input: ContactInput): Omit<Contact, 'id' | 'farmId' | 'ownerId'> {
  const name = clean(input.name);
  if (!name) throw appError('BAD_INPUT', 'Give the contact a name');
  const email = clean(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw appError('BAD_INPUT', 'Email should look like name@example.com');
  const fields = {
    kind: input.kind,
    name,
    phone: checkedPhone(input.phone, 'Phone'),
    emergencyPhone: checkedPhone(input.emergencyPhone, 'Emergency phone'),
    email,
    website: checkedWebsite(input.website),
    address: clean(input.address),
    notes: clean(input.notes),
  };
  if (!fields.phone && !fields.emergencyPhone && !fields.email && !fields.website)
    throw appError('BAD_INPUT', 'Add a phone, email or website so you can reach them');
  return fields;
}

/** Emergency line first, then by name. */
const forEmergency = (a: Contact, b: Contact) =>
  Number(!a.emergencyPhone) - Number(!b.emergencyPhone) || a.name.localeCompare(b.name);

/**
 * v4: contacts (vets, feed merchants, suppliers). A farm's contacts are shared with its members
 * (workers and owners can change them); personal ones belong to one user, e.g. for their pets.
 */
export function createKeepingService(deps: KeepingDeps) {
  const { keeping, farmService } = deps;

  async function requireContact(userId: string, id: string, level: 'view' | 'work') {
    const contact = await keeping.getContact(id);
    if (contact?.ownerId === userId) return contact;
    if (contact?.farmId) {
      await farmService.requireFarm(userId, contact.farmId, level);
      return contact;
    }
    throw appError('NOT_FOUND', `Contact ${id} not found`);
  }

  return {
    async contacts(userId: string, farmId?: string | null) {
      if (!farmId) return keeping.listContacts({ ownerId: userId });
      await farmService.requireFarm(userId, farmId, 'view');
      return keeping.listContacts({ farmIds: [farmId] });
    },

    /** Every vet the user can call: their farms' and their own, out-of-hours lines first. */
    async emergencyContacts(userId: string) {
      const farmIds = (await farmService.listFarms(userId)).map((f) => f.id);
      const all = [
        ...(await keeping.listContacts({ farmIds })),
        ...(await keeping.listContacts({ ownerId: userId })),
      ];
      // The same practice saved on several farms is listed once.
      const seen = new Set<string>();
      return all
        .filter((c) => c.kind === 'VET')
        .sort(forEmergency)
        .filter((c) => {
          const key = [c.name.toLowerCase(), c.phone, c.emergencyPhone].join('|');
          return seen.has(key) ? false : (seen.add(key), true);
        });
    },

    async addContact(userId: string, input: ContactInput) {
      const fields = checkedContact(input);
      if (input.farmId) {
        await farmService.requireFarm(userId, input.farmId, 'work');
        return keeping.addContact({ ...fields, farmId: input.farmId, ownerId: null });
      }
      return keeping.addContact({ ...fields, farmId: null, ownerId: userId });
    },

    async updateContact(userId: string, id: string, input: ContactInput) {
      await requireContact(userId, id, 'work');
      const patch: ContactPatch = checkedContact(input);
      const updated = await keeping.updateContact(id, patch);
      if (!updated) throw appError('NOT_FOUND', `Contact ${id} not found`);
      return updated;
    },

    async deleteContact(userId: string, id: string) {
      try {
        await requireContact(userId, id, 'work');
      } catch (err) {
        if ((err as { extensions?: { code?: string } }).extensions?.code === 'NOT_FOUND')
          return false;
        throw err;
      }
      return keeping.deleteContact(id);
    },
  };
}

export type KeepingService = ReturnType<typeof createKeepingService>;

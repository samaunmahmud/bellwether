import { isIsoDate, londonToday } from '../dates';
import {
  tidyTag,
  type AnimalSex,
  type AnimalStatus,
  type Contact,
  type ContactKind,
  type TaggedAnimal,
  type TaggedSpecies,
} from '../domain/keeping';
import { appError } from '../errors';
import type {
  ContactPatch,
  KeepingRepository,
  NewTaggedAnimal,
} from '../repositories/keepingRepository';
import type { FarmService } from './farmService';
import { checkedDateOfBirth } from './petService';

export interface KeepingDeps {
  keeping: KeepingRepository;
  farmService: FarmService;
  now?: () => Date;
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

export interface TaggedAnimalInput {
  farmId: string;
  groupId?: string | null;
  tag: string;
  name?: string | null;
  species: TaggedSpecies;
  sex: AnimalSex;
  breed?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
}

/** Omitted fields are unchanged; null clears an optional one. Species can't change. */
export interface TaggedAnimalUpdate {
  groupId?: string | null;
  tag?: string | null;
  name?: string | null;
  sex?: AnimalSex | null;
  breed?: string | null;
  dateOfBirth?: string | null;
  status?: AnimalStatus | null;
  statusDate?: string | null;
  notes?: string | null;
}

/** Catches a mistyped year; older than any working sheep or cow. Heuristic, not a lifespan. */
const MAX_LIVESTOCK_AGE_YEARS = 25;
const MAX_TAG = 40;

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

const withoutId = ({ id: _id, ...rest }: TaggedAnimal): NewTaggedAnimal => rest;

/** Whole calendar months from one YYYY-MM-DD to a later one. */
export function monthsBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
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
  const today = () => londonToday((deps.now ?? (() => new Date()))());

  async function requireTagged(userId: string, id: string, level: 'view' | 'work') {
    const animal = await keeping.getTagged(id);
    if (!animal) throw appError('NOT_FOUND', `Animal ${id} not found`);
    await farmService.requireFarm(userId, animal.farmId, level);
    return animal;
  }

  /** The animal's group must be an active one on the same farm, of the same species. */
  async function checkedGroup(userId: string, farmId: string, species: TaggedSpecies, id: string) {
    const group = await farmService.getGroup(userId, id);
    if (!group || group.farmId !== farmId)
      throw appError('NOT_FOUND', `Group ${id} not found on this farm`);
    if (group.archivedOn) throw appError('BAD_INPUT', `${group.name} has been archived`);
    if (group.species !== species)
      throw appError(
        'BAD_INPUT',
        `${group.name} is a ${group.species.toLowerCase()} group: the species must match`,
      );
    return group.id;
  }

  function checkedTag(raw: string) {
    const tag = tidyTag(raw);
    if (!tag) throw appError('BAD_INPUT', 'Give the ear tag or ID');
    if (tag.length > MAX_TAG)
      throw appError('BAD_INPUT', `Keep the tag under ${MAX_TAG} characters`);
    return tag;
  }

  async function requireFreeTag(farmId: string, tag: string, selfId?: string) {
    const existing = await keeping.findTaggedByTag(farmId, tag);
    if (existing && existing.id !== selfId)
      throw appError('BAD_INPUT', `${existing.tag} is already on this farm`);
  }

  /** Sold or died needs a date, not in the future nor before birth; on the farm has none. */
  function checkStatus(animal: NewTaggedAnimal) {
    if (animal.status === 'ON_FARM') return { ...animal, statusDate: null };
    const date = animal.statusDate;
    const what = animal.status === 'SOLD' ? 'it was sold' : 'it died';
    if (!date) throw appError('BAD_INPUT', `Give the date ${what}`);
    if (!isIsoDate(date)) throw appError('BAD_INPUT', 'Date must be YYYY-MM-DD');
    if (date > today()) throw appError('BAD_INPUT', 'The date cannot be in the future');
    if (animal.dateOfBirth && date < animal.dateOfBirth)
      throw appError('BAD_INPUT', 'The date cannot be before its date of birth');
    return animal;
  }

  const dob = (raw: string | null | undefined) =>
    checkedDateOfBirth(raw, today(), MAX_LIVESTOCK_AGE_YEARS);

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

    async taggedAnimals(userId: string, farmId: string) {
      await farmService.requireFarm(userId, farmId, 'view');
      return keeping.listTagged(farmId);
    },

    /** A group's animals that are still on the farm. Only for a group the caller can see. */
    taggedInGroup: async (farmId: string, groupId: string) =>
      (await keeping.listTagged(farmId)).filter(
        (a) => a.groupId === groupId && a.status === 'ON_FARM',
      ),

    async addTaggedAnimal(userId: string, input: TaggedAnimalInput) {
      await farmService.requireFarm(userId, input.farmId, 'work');
      const tag = checkedTag(input.tag);
      const animal: NewTaggedAnimal = {
        farmId: input.farmId,
        groupId: input.groupId
          ? await checkedGroup(userId, input.farmId, input.species, input.groupId)
          : null,
        tag,
        name: clean(input.name),
        species: input.species,
        sex: input.sex,
        breed: clean(input.breed),
        dateOfBirth: dob(input.dateOfBirth) ?? null,
        status: 'ON_FARM',
        statusDate: null,
        notes: clean(input.notes),
      };
      await requireFreeTag(input.farmId, tag);
      return keeping.addTagged(animal);
    },

    async updateTaggedAnimal(userId: string, id: string, input: TaggedAnimalUpdate) {
      const current = await requireTagged(userId, id, 'work');
      const next = withoutId(current);
      if (input.tag != null) next.tag = checkedTag(input.tag);
      if (input.groupId !== undefined)
        next.groupId = input.groupId
          ? await checkedGroup(userId, current.farmId, current.species, input.groupId)
          : null;
      if (input.name !== undefined) next.name = clean(input.name);
      if (input.sex != null) next.sex = input.sex;
      if (input.breed !== undefined) next.breed = clean(input.breed);
      if (input.dateOfBirth !== undefined) next.dateOfBirth = dob(input.dateOfBirth) ?? null;
      if (input.status != null) next.status = input.status;
      if (input.statusDate !== undefined) next.statusDate = input.statusDate || null;
      if (input.notes !== undefined) next.notes = clean(input.notes);
      const checked = checkStatus(next);
      await requireFreeTag(current.farmId, checked.tag, id);
      const updated = await keeping.updateTagged(id, checked);
      if (!updated) throw appError('NOT_FOUND', `Animal ${id} not found`);
      return updated;
    },

    async deleteTaggedAnimal(userId: string, id: string) {
      const animal = await keeping.getTagged(id);
      if (!animal || !(await farmService.getRole(animal.farmId, userId))) return false;
      await requireTagged(userId, id, 'work');
      return keeping.deleteTagged(id);
    },

    /** Whole months old today, or null without a date of birth. */
    ageMonths(animal: { dateOfBirth: string | null }) {
      return animal.dateOfBirth ? monthsBetween(animal.dateOfBirth, today()) : null;
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

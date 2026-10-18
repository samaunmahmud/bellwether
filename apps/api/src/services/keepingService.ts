import { isIsoDate, londonToday } from '../dates';
import {
  tidyTag,
  type AnimalSex,
  type AnimalStatus,
  type Contact,
  type ContactKind,
  type DocumentKind,
  type StoredDocument,
  type TaggedAnimal,
  type TaggedSpecies,
} from '../domain/keeping';
import { appError } from '../errors';
import type { AnimalRepository } from '../repositories/animalRepository';
import type {
  CameraPatch,
  ContactPatch,
  DocumentPatch,
  KeepingRepository,
  NewTaggedAnimal,
} from '../repositories/keepingRepository';
import { daysBetween, decodeDocument, tidyFileName, titleFromFileName } from './documentFiles';
import type { FarmService } from './farmService';
import { checkedDateOfBirth } from './petService';

export interface KeepingDeps {
  keeping: KeepingRepository;
  /** Pets, for their documents */
  animals: AnimalRepository;
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

export interface DocumentInput {
  /** Exactly one of farmId or petId */
  farmId?: string | null;
  petId?: string | null;
  /** Farm documents only */
  groupId?: string | null;
  taggedAnimalId?: string | null;
  kind: DocumentKind;
  /** Defaults to the file name without its extension */
  title?: string | null;
  fileName: string;
  /** The file, base64 or a data: URL */
  contentBase64: string;
  documentDate?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
}

/** Omitted fields are unchanged; null clears an optional one. The file itself can't change. */
export interface DocumentUpdate {
  kind?: DocumentKind | null;
  title?: string | null;
  documentDate?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
}

export interface CameraInput {
  farmId: string;
  name: string;
  /** The camera's own web viewer: http(s) only */
  url: string;
  fieldId?: string | null;
  groupId?: string | null;
  notes?: string | null;
}

/** Omitted fields are unchanged; null clears a link or the notes. */
export interface CameraUpdate {
  name?: string | null;
  url?: string | null;
  fieldId?: string | null;
  groupId?: string | null;
  notes?: string | null;
}

/** Documents expiring within this many days (or already expired) are flagged. Heuristic. */
export const EXPIRY_WARNING_DAYS = 30;
const MAX_TITLE = 120;

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
 * v4: contacts (vets, feed merchants, suppliers), tagged animals and documents. A farm's contacts are shared with its members
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

  async function ownPet(userId: string, id: string) {
    const pet = await deps.animals.getAnimal(id);
    if (pet?.ownerId !== userId) throw appError('NOT_FOUND', `Pet ${id} not found`);
    return pet;
  }

  /** A farm member (at the given level) or the pet's owner; anyone else gets "not found". */
  async function requireDocument(userId: string, id: string, level: 'view' | 'work') {
    const doc = await keeping.getDocument(id);
    if (doc?.farmId) {
      await farmService.requireFarm(userId, doc.farmId, level);
      return doc;
    }
    if (doc?.petId && (await deps.animals.getAnimal(doc.petId))?.ownerId === userId) return doc;
    throw appError('NOT_FOUND', `Document ${id} not found`);
  }

  function checkedTitle(raw: string | null | undefined, fileName: string) {
    const title = raw?.trim() || titleFromFileName(fileName);
    if (title.length > MAX_TITLE)
      throw appError('BAD_INPUT', `Keep the title under ${MAX_TITLE} characters`);
    return title;
  }

  function checkedDocDate(raw: string | null | undefined) {
    if (!raw) return null;
    if (!isIsoDate(raw)) throw appError('BAD_INPUT', 'Dates must be YYYY-MM-DD');
    if (raw > today()) throw appError('BAD_INPUT', 'The document date cannot be in the future');
    return raw;
  }

  function checkedExpiry(raw: string | null | undefined) {
    if (!raw) return null;
    if (!isIsoDate(raw)) throw appError('BAD_INPUT', 'Dates must be YYYY-MM-DD');
    return raw;
  }

  /** A group or animal to link must be on the document's farm. */
  async function checkedLinks(userId: string, farmId: string, input: DocumentInput) {
    let groupId = input.groupId || null;
    let taggedAnimalId: string | null = null;
    if (groupId) {
      const group = await farmService.getGroup(userId, groupId);
      if (!group || group.farmId !== farmId)
        throw appError('NOT_FOUND', `Group ${groupId} not found on this farm`);
    }
    if (input.taggedAnimalId) {
      const animal = await keeping.getTagged(input.taggedAnimalId);
      if (!animal || animal.farmId !== farmId)
        throw appError('NOT_FOUND', `Animal ${input.taggedAnimalId} not found on this farm`);
      taggedAnimalId = animal.id;
      // The animal's group comes with it, so the document shows on the group too.
      groupId ??= animal.groupId;
    }
    return { groupId, taggedAnimalId };
  }

  async function requireCamera(userId: string, id: string, level: 'view' | 'work') {
    const camera = await keeping.getCamera(id);
    if (!camera) throw appError('NOT_FOUND', `Camera ${id} not found`);
    await farmService.requireFarm(userId, camera.farmId, level);
    return camera;
  }

  function checkedCameraName(raw: string | null | undefined) {
    const name = clean(raw);
    if (!name) throw appError('BAD_INPUT', 'Give the camera a name, e.g. Lambing shed');
    return name;
  }

  /** A browser can only open web pages, so stream addresses such as rtsp:// are refused. */
  function checkedCameraUrl(raw: string | null | undefined) {
    const url = clean(raw) ? checkedWebsite(raw) : null;
    if (!url)
      throw appError(
        'BAD_INPUT',
        'Give the web address of the camera’s viewer page, e.g. cams.example.com',
      );
    return url;
  }

  /** A field or group to link must be on the camera's farm. */
  async function checkedCameraLinks(userId: string, farmId: string, input: CameraUpdate) {
    const links: CameraPatch = {};
    if (input.fieldId !== undefined) {
      const field = input.fieldId ? await farmService.getField(input.fieldId) : null;
      if (input.fieldId && field?.farmId !== farmId)
        throw appError('NOT_FOUND', `Field ${input.fieldId} not found on this farm`);
      links.fieldId = field?.id ?? null;
    }
    if (input.groupId !== undefined) {
      const group = input.groupId ? await farmService.getGroup(userId, input.groupId) : null;
      if (input.groupId && group?.farmId !== farmId)
        throw appError('NOT_FOUND', `Group ${input.groupId} not found on this farm`);
      links.groupId = group?.id ?? null;
    }
    return links;
  }

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

    /** Only for an animal linked to a document the caller can see. */
    taggedById: (id: string) => keeping.getTagged(id),

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

    async documents(userId: string, scope: { farmId?: string | null; petId?: string | null }) {
      if (scope.farmId && !scope.petId) {
        await farmService.requireFarm(userId, scope.farmId, 'view');
        return keeping.listDocuments({ farmId: scope.farmId });
      }
      if (scope.petId && !scope.farmId) {
        await ownPet(userId, scope.petId);
        return keeping.listDocuments({ petId: scope.petId });
      }
      throw appError('BAD_INPUT', 'Choose a farm or a pet');
    },

    /** A pet's documents. Only for a pet the caller was already allowed to see. */
    petDocuments: (petId: string) => keeping.listDocuments({ petId }),

    async documentFile(userId: string, id: string) {
      const doc = await requireDocument(userId, id, 'view');
      const content = await keeping.getDocumentContent(id);
      if (!content) throw appError('NOT_FOUND', `Document ${id} not found`);
      return {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        contentBase64: Buffer.from(content).toString('base64'),
      };
    },

    /** Expired or expiring soon, across the user's farms and pets: soonest first. */
    async expiringDocuments(userId: string) {
      const farms = await farmService.listFarms(userId);
      const pets = await deps.animals.listAnimals(userId);
      const all = [
        ...(await Promise.all(farms.map((f) => keeping.listDocuments({ farmId: f.id })))),
        ...(await Promise.all(pets.map((p) => keeping.listDocuments({ petId: p.id })))),
      ].flat();
      const limit = today();
      return all
        .filter((d) => d.expiresOn && daysBetween(limit, d.expiresOn) <= EXPIRY_WARNING_DAYS)
        .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
    },

    async addDocument(userId: string, input: DocumentInput) {
      if (!input.farmId === !input.petId)
        throw appError('BAD_INPUT', 'A document belongs to a farm or a pet: choose one');
      if (input.farmId) await farmService.requireFarm(userId, input.farmId, 'work');
      else {
        await ownPet(userId, input.petId!);
        if (input.groupId || input.taggedAnimalId)
          throw appError('BAD_INPUT', 'Only a farm document can be linked to a group or animal');
      }
      const fileName = tidyFileName(input.fileName);
      const title = checkedTitle(input.title, fileName);
      const documentDate = checkedDocDate(input.documentDate);
      const expiresOn = checkedExpiry(input.expiresOn);
      const notes = clean(input.notes);
      const links = input.farmId
        ? await checkedLinks(userId, input.farmId, input)
        : { groupId: null, taggedAnimalId: null };
      const { bytes, mimeType } = decodeDocument(input.contentBase64);
      return keeping.addDocument(
        {
          farmId: input.farmId || null,
          petId: input.petId || null,
          ...links,
          kind: input.kind,
          title,
          fileName,
          mimeType,
          sizeBytes: bytes.length,
          documentDate,
          expiresOn,
          notes,
          uploadedById: userId,
          uploadedAt: (deps.now ?? (() => new Date()))().toISOString(),
        },
        bytes,
      );
    },

    async updateDocument(userId: string, id: string, input: DocumentUpdate) {
      const doc = await requireDocument(userId, id, 'work');
      const patch: DocumentPatch = {};
      if (input.kind != null) patch.kind = input.kind;
      if (input.title !== undefined) {
        if (!input.title?.trim()) throw appError('BAD_INPUT', 'Give the document a title');
        patch.title = checkedTitle(input.title, doc.fileName);
      }
      if (input.documentDate !== undefined) patch.documentDate = checkedDocDate(input.documentDate);
      if (input.expiresOn !== undefined) patch.expiresOn = checkedExpiry(input.expiresOn);
      if (input.notes !== undefined) patch.notes = clean(input.notes);
      const updated = await keeping.updateDocument(id, patch);
      if (!updated) throw appError('NOT_FOUND', `Document ${id} not found`);
      return updated;
    },

    async deleteDocument(userId: string, id: string) {
      try {
        await requireDocument(userId, id, 'work');
      } catch (err) {
        if ((err as { extensions?: { code?: string } }).extensions?.code === 'NOT_FOUND')
          return false;
        throw err;
      }
      return keeping.deleteDocument(id);
    },

    /** Days until it expires (negative once expired), or null with no expiry. */
    daysToExpiry: (doc: StoredDocument) =>
      doc.expiresOn ? daysBetween(today(), doc.expiresOn) : null,

    async cameras(userId: string, farmId: string) {
      await farmService.requireFarm(userId, farmId, 'view');
      return keeping.listCameras(farmId);
    },

    async addCamera(userId: string, input: CameraInput) {
      await farmService.requireFarm(userId, input.farmId, 'work');
      const name = checkedCameraName(input.name);
      const url = checkedCameraUrl(input.url);
      const links = await checkedCameraLinks(userId, input.farmId, {
        fieldId: input.fieldId ?? null,
        groupId: input.groupId ?? null,
      });
      return keeping.addCamera({
        farmId: input.farmId,
        name,
        url,
        fieldId: links.fieldId ?? null,
        groupId: links.groupId ?? null,
        notes: clean(input.notes),
      });
    },

    async updateCamera(userId: string, id: string, input: CameraUpdate) {
      const camera = await requireCamera(userId, id, 'work');
      const patch: CameraPatch = await checkedCameraLinks(userId, camera.farmId, input);
      if (input.name !== undefined) patch.name = checkedCameraName(input.name);
      if (input.url !== undefined) patch.url = checkedCameraUrl(input.url);
      if (input.notes !== undefined) patch.notes = clean(input.notes);
      const updated = await keeping.updateCamera(id, patch);
      if (!updated) throw appError('NOT_FOUND', `Camera ${id} not found`);
      return updated;
    },

    async deleteCamera(userId: string, id: string) {
      try {
        await requireCamera(userId, id, 'work');
      } catch (err) {
        if ((err as { extensions?: { code?: string } }).extensions?.code === 'NOT_FOUND')
          return false;
        throw err;
      }
      return keeping.deleteCamera(id);
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

/** v4: the people a farm or pet owner deals with. */
export type ContactKind = 'VET' | 'FEED' | 'SUPPLIER' | 'OTHER';

export interface Contact {
  id: string;
  /** A farm's contact, shared with its members; or… */
  farmId: string | null;
  /** …a user's own (e.g. their pet's vet). Exactly one of the two is set. */
  ownerId: string | null;
  kind: ContactKind;
  name: string;
  phone: string | null;
  /** Out-of-hours or emergency line */
  emergencyPhone: string | null;
  email: string | null;
  /** Always http(s) */
  website: string | null;
  address: string | null;
  notes: string | null;
}

export type TaggedSpecies = 'SHEEP' | 'CATTLE';
export type AnimalSex = 'FEMALE' | 'MALE' | 'CASTRATED';
export type AnimalStatus = 'ON_FARM' | 'SOLD' | 'DIED';

/** v4: one animal with its own ear tag or ID, beside the group head counts. */
export interface TaggedAnimal {
  id: string;
  farmId: string;
  groupId: string | null;
  /** As written, tidied: trimmed, single spaces, upper case */
  tag: string;
  name: string | null;
  species: TaggedSpecies;
  sex: AnimalSex;
  breed: string | null;
  dateOfBirth: string | null;
  status: AnimalStatus;
  /** When it was sold or died */
  statusDate: string | null;
  notes: string | null;
}

/** "UK 123  456" → "UK 123 456" */
export const tidyTag = (tag: string) => tag.trim().replace(/\s+/g, ' ').toUpperCase();

/** For comparing tags: no spaces, upper case. */
export const tagKey = (tag: string) => tag.replace(/\s+/g, '').toUpperCase();

/** Tags in natural order: UK 2 before UK 10. */
export const byTag = (a: { tag: string }, b: { tag: string }) =>
  a.tag.localeCompare(b.tag, 'en-GB', { numeric: true });

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

export type DocumentKind =
  'HEALTH' | 'CERTIFICATE' | 'MOVEMENT' | 'INSURANCE' | 'RECEIPT' | 'OTHER';

/** v4: a stored file (vet report, certificate, movement licence…) for a farm or a pet. */
export interface StoredDocument {
  id: string;
  /** A farm's document, shared with its members; or… */
  farmId: string | null;
  /** …a pet's, private to its owner. Exactly one of the two is set. */
  petId: string | null;
  /** Optional links within the farm */
  groupId: string | null;
  taggedAnimalId: string | null;
  kind: DocumentKind;
  title: string;
  fileName: string;
  /** Taken from the file's contents, not its name */
  mimeType: DocumentMimeType;
  sizeBytes: number;
  /** The date on the document, e.g. when the test was taken */
  documentDate: string | null;
  expiresOn: string | null;
  notes: string | null;
  uploadedById: string | null;
  /** ISO date-time */
  uploadedAt: string;
}

export type DocumentMimeType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

const startsWith = (bytes: Uint8Array, prefix: number[], at = 0) =>
  bytes.length >= at + prefix.length && prefix.every((b, i) => bytes[at + i] === b);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/**
 * The file's type from its first bytes ("magic numbers"), or null if it isn't one we keep.
 * Trusting the name or the browser's type would let any file through as "a PDF".
 */
export function sniffDocumentType(bytes: Uint8Array): DocumentMimeType | null {
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

/** Newest upload first. */
export const byNewestUpload = (a: StoredDocument, b: StoredDocument) =>
  b.uploadedAt.localeCompare(a.uploadedAt) || a.title.localeCompare(b.title);

/**
 * v4.2: a link to a farm camera's own web viewer (CCTV app or cloud page). Bellwether doesn't
 * stream video itself; it opens the camera maker's page.
 */
export interface Camera {
  id: string;
  farmId: string;
  name: string;
  /** Always http(s) */
  url: string;
  /** Where it points, optionally */
  fieldId: string | null;
  groupId: string | null;
  notes: string | null;
}

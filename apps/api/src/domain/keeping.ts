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

export type Species = 'CATTLE' | 'SHEEP';
export type LivestockClass = 'EWES' | 'LAMBS' | 'RAMS' | 'DAIRY_COWS' | 'BEEF_CATTLE' | 'CALVES';
export type CattleType = 'DAIRY' | 'BEEF';
/**
 * FR-8.2: OWNER manages everything; WORKER does day-to-day work (records, tasks, moves);
 * VIEWER can only look.
 */
export type FarmRole = 'OWNER' | 'WORKER' | 'VIEWER';

/** FR-8.2: an invitation to join a farm, matched to whoever signs in with that email. */
export interface FarmInvite {
  id: string;
  farmId: string;
  /** Normalised (trimmed, lower case) */
  email: string;
  role: FarmRole;
  invitedById: string | null;
}

/** FR-2.1 */
export interface Farm {
  id: string;
  name: string;
  /** Normalised UK postcode, e.g. "UB8 3PH" */
  postcode: string;
}

/** FR-2.2: a field's location is a map pin, else its own postcode, else the farm postcode. */
export interface Field {
  id: string;
  farmId: string;
  name: string;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Archived fields keep their history but can't take new moves. */
  archivedOn: string | null;
}

/** FR-2.3 + FR-2.5. Dates are ISO strings (YYYY-MM-DD). */
export interface LivestockGroup {
  id: string;
  farmId: string;
  name: string;
  species: Species;
  livestockClass: LivestockClass;
  headCount: number;
  currentFieldId: string | null;
  housed: boolean;
  // Sheep only
  lastShearingDate: string | null;
  lambingStart: string | null;
  lambingEnd: string | null;
  lambsAtGrassThisSpring: boolean;
  // Cattle only
  cattleType: CattleType | null;
  calvingStart: string | null;
  calvingEnd: string | null;
  /** Sold, finished or otherwise gone. Records are kept; it drops out of briefings. */
  archivedOn: string | null;
  archiveReason: string | null;
}

/** FR-2.4: one row per move, so a group's field history is kept. */
export interface GroupMovement {
  id: string;
  farmId: string;
  groupId: string;
  fromFieldId: string | null;
  toFieldId: string;
  movedOn: string;
}

export const CLASSES_BY_SPECIES: Record<Species, readonly LivestockClass[]> = {
  SHEEP: ['EWES', 'LAMBS', 'RAMS'],
  CATTLE: ['DAIRY_COWS', 'BEEF_CATTLE', 'CALVES'],
};

/** Approximate bounding box for the UK, used to catch mistyped or swapped map pins. */
export const UK_BOUNDS = { minLat: 49.8, maxLat: 60.9, minLon: -8.7, maxLon: 1.8 } as const;

export type LocationSource = 'PIN' | 'FIELD_POSTCODE' | 'FARM_POSTCODE';

export type LocationRef =
  | { source: 'PIN'; latitude: number; longitude: number }
  | { source: 'FIELD_POSTCODE' | 'FARM_POSTCODE'; postcode: string };

/**
 * FR-2.2: where to get weather for a group. A pin beats the field postcode, which beats the farm postcode.
 * Housed groups always use the farm postcode, on the assumption that sheds are at the farmstead
 * (docs/decisions.md, A1).
 */
export function resolveLocationRef(farm: Farm, field: Field | null, housed: boolean): LocationRef {
  if (housed) return { source: 'FARM_POSTCODE', postcode: farm.postcode };
  if (field && field.latitude !== null && field.longitude !== null) {
    return { source: 'PIN', latitude: field.latitude, longitude: field.longitude };
  }
  if (field?.postcode) return { source: 'FIELD_POSTCODE', postcode: field.postcode };
  return { source: 'FARM_POSTCODE', postcode: farm.postcode };
}

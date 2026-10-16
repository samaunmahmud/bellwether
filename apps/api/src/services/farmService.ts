import { isIsoDate, londonToday } from '../dates';
import {
  CLASSES_BY_SPECIES,
  resolveLocationRef,
  UK_BOUNDS,
  type CattleType,
  type LivestockClass,
  type LivestockGroup,
  type LocationSource,
  type Species,
} from '../domain/farm';
import { appError } from '../errors';
import type { FarmRepository, GroupPatch, NewGroup } from '../repositories/farmRepository';
import type { LocationService } from './locationService';

const MAX_NAME_LENGTH = 100;

const CATTLE_TYPE_FOR_CLASS: Partial<Record<LivestockClass, CattleType>> = {
  DAIRY_COWS: 'DAIRY',
  BEEF_CATTLE: 'BEEF',
};

export interface FarmInput {
  name: string;
  postcode: string;
}

export interface FieldInput {
  farmId: string;
  name: string;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GroupAttributes {
  lastShearingDate?: string | null;
  lambingStart?: string | null;
  lambingEnd?: string | null;
  lambsAtGrassThisSpring?: boolean | null;
  cattleType?: CattleType | null;
  calvingStart?: string | null;
  calvingEnd?: string | null;
}

export interface GroupInput extends GroupAttributes {
  farmId: string;
  name: string;
  species: Species;
  livestockClass: LivestockClass;
  headCount: number;
  currentFieldId?: string | null;
  housed?: boolean | null;
}

/** Omitted keeps the current value. Null clears a date or cattle type, and is ignored for required attributes. */
export interface GroupUpdate extends GroupAttributes {
  name?: string | null;
  livestockClass?: LivestockClass | null;
  headCount?: number | null;
  housed?: boolean | null;
}

export interface MoveInput {
  groupId: string;
  toFieldId: string;
  movedOn: string;
}

export interface ResolvedLocation {
  source: LocationSource;
  latitude: number;
  longitude: number;
  postcode: string | null;
}

export interface FarmServiceDeps {
  repo: FarmRepository;
  locations: LocationService;
  now?: () => Date;
}

function requireName(raw: string, what: string): string {
  const name = raw.trim();
  if (!name) throw appError('BAD_INPUT', `${what} name is required`);
  if (name.length > MAX_NAME_LENGTH)
    throw appError('BAD_INPUT', `${what} name must be ${MAX_NAME_LENGTH} characters or fewer`);
  return name;
}

function requireDate(value: string | null, label: string): void {
  if (value !== null && !isIsoDate(value))
    throw appError('BAD_INPUT', `${label} must be a date in the form YYYY-MM-DD`);
}

function requireDateRange(start: string | null, end: string | null, label: string): void {
  if ((start === null) !== (end === null))
    throw appError('BAD_INPUT', `${label} needs both a start and an end date`);
  if (start !== null && end !== null && end < start)
    throw appError('BAD_INPUT', `${label} end date must be on or after the start date`);
}

/** Checks a whole group record against the FR-2.3 / FR-2.5 rules and fills in derived values. */
function validateGroup(group: NewGroup, today: string): NewGroup {
  const { species } = group;
  if (!CLASSES_BY_SPECIES[species].includes(group.livestockClass))
    throw appError('BAD_INPUT', `${group.livestockClass} is not a class of ${species}`);
  if (!Number.isInteger(group.headCount) || group.headCount < 1)
    throw appError('BAD_INPUT', 'Head count must be a whole number of at least 1');

  for (const [key, label] of [
    ['lastShearingDate', 'Last shearing date'],
    ['lambingStart', 'Lambing start'],
    ['lambingEnd', 'Lambing end'],
    ['calvingStart', 'Calving start'],
    ['calvingEnd', 'Calving end'],
  ] as const) {
    requireDate(group[key], label);
  }
  requireDateRange(group.lambingStart, group.lambingEnd, 'Lambing period');
  requireDateRange(group.calvingStart, group.calvingEnd, 'Calving period');
  if (group.lastShearingDate !== null && group.lastShearingDate > today)
    throw appError('BAD_INPUT', 'Last shearing date cannot be in the future');

  if (species === 'CATTLE') {
    const hasSheepAttributes =
      group.lastShearingDate !== null ||
      group.lambingStart !== null ||
      group.lambsAtGrassThisSpring;
    if (hasSheepAttributes)
      throw appError('BAD_INPUT', 'Shearing and lambing details only apply to sheep');

    const implied = CATTLE_TYPE_FOR_CLASS[group.livestockClass];
    if (implied && group.cattleType && group.cattleType !== implied)
      throw appError('BAD_INPUT', `${group.livestockClass} cannot be ${group.cattleType}`);
    return { ...group, cattleType: group.cattleType ?? implied ?? null };
  }

  if (group.cattleType !== null || group.calvingStart !== null)
    throw appError('BAD_INPUT', 'Dairy/beef and calving details only apply to cattle');
  return group;
}

export function createFarmService(deps: FarmServiceDeps) {
  const { repo, locations } = deps;
  const today = () => londonToday((deps.now ?? (() => new Date()))());

  async function requireFarm(id: string) {
    const farm = await repo.getFarm(id);
    if (!farm) throw appError('NOT_FOUND', `Farm ${id} not found`);
    return farm;
  }

  async function requireGroup(id: string) {
    const group = await repo.getGroup(id);
    if (!group) throw appError('NOT_FOUND', `Livestock group ${id} not found`);
    return group;
  }

  async function requireFieldOnFarm(fieldId: string, farmId: string) {
    const field = await repo.getField(fieldId);
    if (!field || field.farmId !== farmId)
      throw appError('NOT_FOUND', `Field ${fieldId} not found on this farm`);
    return field;
  }

  return {
    listFarms: () => repo.listFarms(),
    getFarm: (id: string) => repo.getFarm(id),
    getField: (id: string) => repo.getField(id),
    listFields: (farmId: string) => repo.listFields(farmId),
    getGroup: (id: string) => repo.getGroup(id),
    listGroups: (farmId: string) => repo.listGroups(farmId),
    listMovements: (groupId: string) => repo.listMovements(groupId),

    /** FR-2.1 */
    async createFarm(input: FarmInput) {
      const name = requireName(input.name, 'Farm');
      const location = await locations.findPostcode(input.postcode);
      return repo.createFarm({ name, postcode: location.postcode });
    },

    /** FR-2.2 */
    async createField(input: FieldInput) {
      const name = requireName(input.name, 'Field');
      await requireFarm(input.farmId);

      const latitude = input.latitude ?? null;
      const longitude = input.longitude ?? null;
      if ((latitude === null) !== (longitude === null))
        throw appError('BAD_INPUT', 'A map pin needs both latitude and longitude');
      if (
        latitude !== null &&
        longitude !== null &&
        !(
          latitude >= UK_BOUNDS.minLat &&
          latitude <= UK_BOUNDS.maxLat &&
          longitude >= UK_BOUNDS.minLon &&
          longitude <= UK_BOUNDS.maxLon
        )
      )
        throw appError('BAD_INPUT', 'The map pin must be inside the UK');

      const postcode = input.postcode
        ? (await locations.findPostcode(input.postcode)).postcode
        : null;
      return repo.createField({ farmId: input.farmId, name, postcode, latitude, longitude });
    },

    /** FR-2.3, FR-2.5. A starting field is recorded as the group's first movement, dated today. */
    async createGroup(input: GroupInput) {
      await requireFarm(input.farmId);
      const currentFieldId = input.currentFieldId ?? null;
      if (currentFieldId) await requireFieldOnFarm(currentFieldId, input.farmId);

      const group = validateGroup(
        {
          farmId: input.farmId,
          name: requireName(input.name, 'Group'),
          species: input.species,
          livestockClass: input.livestockClass,
          headCount: input.headCount,
          currentFieldId,
          housed: input.housed ?? false,
          lastShearingDate: input.lastShearingDate ?? null,
          lambingStart: input.lambingStart ?? null,
          lambingEnd: input.lambingEnd ?? null,
          lambsAtGrassThisSpring: input.lambsAtGrassThisSpring ?? false,
          cattleType: input.cattleType ?? null,
          calvingStart: input.calvingStart ?? null,
          calvingEnd: input.calvingEnd ?? null,
        },
        today(),
      );
      return repo.createGroup(group, currentFieldId ? today() : null);
    },

    async updateGroup(id: string, update: GroupUpdate) {
      const existing = await requireGroup(id);

      const patch: GroupPatch = {};
      if (update.name != null) patch.name = requireName(update.name, 'Group');
      if (update.livestockClass != null) patch.livestockClass = update.livestockClass;
      if (update.headCount != null) patch.headCount = update.headCount;
      if (update.housed != null) patch.housed = update.housed;
      if (update.lambsAtGrassThisSpring != null)
        patch.lambsAtGrassThisSpring = update.lambsAtGrassThisSpring;
      for (const key of [
        'lastShearingDate',
        'lambingStart',
        'lambingEnd',
        'cattleType',
        'calvingStart',
        'calvingEnd',
      ] as const) {
        if (update[key] !== undefined) Object.assign(patch, { [key]: update[key] });
      }
      // A new cattle class implies a new dairy/beef type unless one was given.
      if (patch.livestockClass && update.cattleType === undefined) {
        patch.cattleType = CATTLE_TYPE_FOR_CLASS[patch.livestockClass] ?? existing.cattleType;
      }

      const valid = validateGroup({ ...existing, ...patch }, today());
      return repo.updateGroup(id, { ...patch, cattleType: valid.cattleType });
    },

    /**
     * FR-2.4. Every move is kept. A backdated move (before the latest recorded one) is added to the
     * history without changing where the group is now.
     */
    async moveGroup(input: MoveInput) {
      if (!isIsoDate(input.movedOn))
        throw appError('BAD_INPUT', 'Move date must be a date in the form YYYY-MM-DD');
      if (input.movedOn > today()) throw appError('BAD_INPUT', 'Move date cannot be in the future');

      const group = await requireGroup(input.groupId);
      await requireFieldOnFarm(input.toFieldId, group.farmId);

      const history = await repo.listMovements(group.id);
      const latest = history[0];
      const setAsCurrent = !latest || input.movedOn >= latest.movedOn;
      const fromFieldId = setAsCurrent
        ? group.currentFieldId
        : (history.find((m) => m.movedOn <= input.movedOn)?.toFieldId ?? null);
      if (fromFieldId === input.toFieldId)
        throw appError('BAD_INPUT', 'The group is already in that field');

      return repo.recordMovement(
        {
          farmId: group.farmId,
          groupId: group.id,
          fromFieldId,
          toFieldId: input.toFieldId,
          movedOn: input.movedOn,
        },
        setAsCurrent,
      );
    },

    /** FR-2.2: the coordinates to forecast for this group, and where they came from. */
    async locateGroup(group: LivestockGroup): Promise<ResolvedLocation> {
      const farm = await requireFarm(group.farmId);
      const field = group.currentFieldId ? await repo.getField(group.currentFieldId) : null;
      const ref = resolveLocationRef(farm, field, group.housed);
      if (ref.source === 'PIN') return { ...ref, postcode: null };
      const location = await locations.findPostcode(ref.postcode);
      return {
        source: ref.source,
        latitude: location.latitude,
        longitude: location.longitude,
        postcode: ref.postcode,
      };
    },
  };
}

export type FarmService = ReturnType<typeof createFarmService>;

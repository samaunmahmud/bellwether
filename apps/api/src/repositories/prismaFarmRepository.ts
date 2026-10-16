import type { PrismaClient } from '../db/prisma';
import type { Field, GroupMovement, LivestockGroup } from '../domain/farm';
import type {
  FarmRepository,
  GroupPatch,
  NewFarm,
  NewField,
  NewGroup,
  NewMovement,
} from './farmRepository';

// Dates are stored as Postgres DATE columns, which Prisma reads as midnight UTC.
const toDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromDb = (date: Date) => date.toISOString().slice(0, 10);
const toDbOrNull = (iso: string | null) => (iso === null ? null : toDb(iso));
const fromDbOrNull = (date: Date | null) => (date === null ? null : fromDb(date));

const DATE_KEYS = [
  'lastShearingDate',
  'lambingStart',
  'lambingEnd',
  'calvingStart',
  'calvingEnd',
] as const;

const farmSelect = { id: true, name: true, postcode: true } as const;
const fieldSelect = {
  id: true,
  farmId: true,
  name: true,
  postcode: true,
  latitude: true,
  longitude: true,
} as const;
const groupSelect = {
  id: true,
  farmId: true,
  name: true,
  species: true,
  livestockClass: true,
  headCount: true,
  currentFieldId: true,
  housed: true,
  lastShearingDate: true,
  lambingStart: true,
  lambingEnd: true,
  lambsAtGrassThisSpring: true,
  cattleType: true,
  calvingStart: true,
  calvingEnd: true,
} as const;
const movementSelect = {
  id: true,
  farmId: true,
  groupId: true,
  fromFieldId: true,
  toFieldId: true,
  movedOn: true,
} as const;

type DbGroup = Omit<LivestockGroup, (typeof DATE_KEYS)[number]> &
  Record<(typeof DATE_KEYS)[number], Date | null>;

function toGroup(row: DbGroup): LivestockGroup {
  return {
    ...row,
    lastShearingDate: fromDbOrNull(row.lastShearingDate),
    lambingStart: fromDbOrNull(row.lambingStart),
    lambingEnd: fromDbOrNull(row.lambingEnd),
    calvingStart: fromDbOrNull(row.calvingStart),
    calvingEnd: fromDbOrNull(row.calvingEnd),
  };
}

/** Converts any ISO date strings in a group (or patch) to Date objects for Prisma. */
function groupDatesToDb<T extends Partial<Pick<LivestockGroup, (typeof DATE_KEYS)[number]>>>(
  input: T,
) {
  const out: Record<string, unknown> = { ...input };
  for (const key of DATE_KEYS) {
    const value = input[key];
    if (value !== undefined) out[key] = toDbOrNull(value);
  }
  return out as Omit<T, (typeof DATE_KEYS)[number]> &
    Partial<Record<(typeof DATE_KEYS)[number], Date | null>>;
}

function toMovement(row: Omit<GroupMovement, 'movedOn'> & { movedOn: Date }): GroupMovement {
  return { ...row, movedOn: fromDb(row.movedOn) };
}

/** Postgres-backed FarmRepository. Shares its contract tests with InMemoryFarmRepository. */
export class PrismaFarmRepository implements FarmRepository {
  constructor(private db: PrismaClient) {}

  createFarm(input: NewFarm) {
    return this.db.farm.create({ data: input, select: farmSelect });
  }

  getFarm(id: string) {
    return this.db.farm.findUnique({ where: { id }, select: farmSelect });
  }

  listFarms() {
    return this.db.farm.findMany({ orderBy: { name: 'asc' }, select: farmSelect });
  }

  createField(input: NewField): Promise<Field> {
    return this.db.field.create({ data: input, select: fieldSelect });
  }

  getField(id: string) {
    return this.db.field.findUnique({ where: { id }, select: fieldSelect });
  }

  listFields(farmId: string) {
    return this.db.field.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
      select: fieldSelect,
    });
  }

  async createGroup(input: NewGroup, placedOn: string | null) {
    const { currentFieldId } = input;
    const row = await this.db.livestockGroup.create({
      data: {
        ...groupDatesToDb(input),
        movements:
          currentFieldId && placedOn
            ? {
                create: {
                  farmId: input.farmId,
                  fromFieldId: null,
                  toFieldId: currentFieldId,
                  movedOn: toDb(placedOn),
                },
              }
            : undefined,
      },
      select: groupSelect,
    });
    return toGroup(row);
  }

  async getGroup(id: string) {
    const row = await this.db.livestockGroup.findUnique({ where: { id }, select: groupSelect });
    return row ? toGroup(row) : null;
  }

  async listGroups(farmId: string) {
    const rows = await this.db.livestockGroup.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
      select: groupSelect,
    });
    return rows.map(toGroup);
  }

  async updateGroup(id: string, patch: GroupPatch) {
    const row = await this.db.livestockGroup.update({
      where: { id },
      data: groupDatesToDb(patch),
      select: groupSelect,
    });
    return toGroup(row);
  }

  async recordMovement(input: NewMovement, setAsCurrent: boolean) {
    const create = this.db.groupMovement.create({
      data: { ...input, movedOn: toDb(input.movedOn) },
      select: movementSelect,
    });
    if (!setAsCurrent) return toMovement(await create);

    const [row] = await this.db.$transaction([
      create,
      this.db.livestockGroup.update({
        where: { id: input.groupId },
        data: { currentFieldId: input.toFieldId },
        select: { id: true },
      }),
    ]);
    return toMovement(row);
  }

  async listMovements(groupId: string) {
    const rows = await this.db.groupMovement.findMany({
      where: { groupId },
      orderBy: [{ movedOn: 'desc' }, { seq: 'desc' }],
      select: movementSelect,
    });
    return rows.map(toMovement);
  }
}

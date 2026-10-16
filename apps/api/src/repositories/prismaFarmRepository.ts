import type { PrismaClient } from '../db/prisma';
import { isUuid } from '../db/ids';
import type { FarmInvite, FarmRole, Field, GroupMovement, LivestockGroup } from '../domain/farm';
import type {
  FarmPatch,
  FarmRepository,
  FieldPatch,
  GroupPatch,
  NewFarm,
  NewField,
  NewGroup,
  NewInvite,
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
  'archivedOn',
] as const;

const farmSelect = { id: true, name: true, postcode: true } as const;
const fieldSelect = {
  id: true,
  farmId: true,
  name: true,
  postcode: true,
  latitude: true,
  longitude: true,
  archivedOn: true,
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
  archivedOn: true,
  archiveReason: true,
} as const;
const inviteSelect = {
  id: true,
  farmId: true,
  email: true,
  role: true,
  invitedById: true,
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
    archivedOn: fromDbOrNull(row.archivedOn),
  };
}

const toField = (row: Omit<Field, 'archivedOn'> & { archivedOn: Date | null }): Field => ({
  ...row,
  archivedOn: fromDbOrNull(row.archivedOn),
});

const definedOnly = (patch: object) =>
  Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

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

  createFarm(input: NewFarm, ownerId: string) {
    return this.db.farm.create({
      data: { ...input, members: { create: { userId: ownerId, role: 'OWNER' } } },
      select: farmSelect,
    });
  }

  getFarm(id: string) {
    if (!isUuid(id)) return Promise.resolve(null);
    return this.db.farm.findUnique({ where: { id }, select: farmSelect });
  }

  listFarmsForUser(userId: string) {
    if (!isUuid(userId)) return Promise.resolve([]);
    return this.db.farm.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
      select: farmSelect,
    });
  }

  async listFarmIds() {
    return (await this.db.farm.findMany({ select: { id: true } })).map((f) => f.id);
  }

  listMembers(farmId: string) {
    if (!isUuid(farmId)) return Promise.resolve([]);
    return this.db.farmMember.findMany({
      where: { farmId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, role: true },
    });
  }

  async getRole(farmId: string, userId: string) {
    if (!isUuid(farmId) || !isUuid(userId)) return null;
    const member = await this.db.farmMember.findUnique({
      where: { farmId_userId: { farmId, userId } },
      select: { role: true },
    });
    return member?.role ?? null;
  }

  async addMember(farmId: string, userId: string, role: FarmRole) {
    await this.db.farmMember.create({ data: { farmId, userId, role } });
  }

  async setMemberRole(farmId: string, userId: string, role: FarmRole) {
    if (!isUuid(farmId) || !isUuid(userId)) return false;
    const { count } = await this.db.farmMember.updateMany({
      where: { farmId, userId },
      data: { role },
    });
    return count > 0;
  }

  async removeMember(farmId: string, userId: string) {
    if (!isUuid(farmId) || !isUuid(userId)) return false;
    const { count } = await this.db.farmMember.deleteMany({ where: { farmId, userId } });
    return count > 0;
  }

  createInvite(input: NewInvite): Promise<FarmInvite> {
    return this.db.farmInvite.upsert({
      where: { farmId_email: { farmId: input.farmId, email: input.email } },
      create: input,
      update: { role: input.role, invitedById: input.invitedById },
      select: inviteSelect,
    });
  }

  getInvite(id: string) {
    if (!isUuid(id)) return Promise.resolve(null);
    return this.db.farmInvite.findUnique({ where: { id }, select: inviteSelect });
  }

  listInvitesForFarm(farmId: string) {
    if (!isUuid(farmId)) return Promise.resolve([]);
    return this.db.farmInvite.findMany({
      where: { farmId },
      orderBy: { createdAt: 'asc' },
      select: inviteSelect,
    });
  }

  listInvitesForEmail(email: string) {
    return this.db.farmInvite.findMany({
      where: { email },
      orderBy: { createdAt: 'asc' },
      select: inviteSelect,
    });
  }

  async deleteInvite(id: string) {
    if (!isUuid(id)) return false;
    const { count } = await this.db.farmInvite.deleteMany({ where: { id } });
    return count > 0;
  }

  async updateFarm(id: string, patch: FarmPatch) {
    if (!isUuid(id)) return null;
    const { count } = await this.db.farm.updateMany({ where: { id }, data: definedOnly(patch) });
    return count ? this.getFarm(id) : null;
  }

  async deleteFarm(id: string) {
    if (!isUuid(id)) return false;
    // Everything on the farm goes with it (onDelete: Cascade).
    const { count } = await this.db.farm.deleteMany({ where: { id } });
    return count > 0;
  }

  async createField(input: NewField): Promise<Field> {
    return toField(await this.db.field.create({ data: input, select: fieldSelect }));
  }

  async getField(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.db.field.findUnique({ where: { id }, select: fieldSelect });
    return row ? toField(row) : null;
  }

  async listFields(farmId: string) {
    if (!isUuid(farmId)) return [];
    const rows = await this.db.field.findMany({
      where: { farmId },
      orderBy: { name: 'asc' },
      select: fieldSelect,
    });
    return rows.map(toField);
  }

  async updateField(id: string, patch: FieldPatch) {
    if (!isUuid(id)) return null;
    const { archivedOn, ...rest } = patch;
    const data: Record<string, unknown> = definedOnly(rest);
    if (archivedOn !== undefined) data.archivedOn = toDbOrNull(archivedOn);
    const { count } = await this.db.field.updateMany({ where: { id }, data });
    return count ? this.getField(id) : null;
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
    if (!isUuid(id)) return null;
    const row = await this.db.livestockGroup.findUnique({ where: { id }, select: groupSelect });
    return row ? toGroup(row) : null;
  }

  async listGroups(farmId: string) {
    if (!isUuid(farmId)) return [];
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
    if (!isUuid(groupId)) return [];
    const rows = await this.db.groupMovement.findMany({
      where: { groupId },
      orderBy: [{ movedOn: 'desc' }, { seq: 'desc' }],
      select: movementSelect,
    });
    return rows.map(toMovement);
  }
}

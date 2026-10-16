import { randomUUID } from 'node:crypto';
import type {
  Farm,
  FarmInvite,
  FarmRole,
  Field,
  GroupMovement,
  LivestockGroup,
} from '../domain/farm';

export type NewFarm = Omit<Farm, 'id'>;
export type NewField = Omit<Field, 'id' | 'archivedOn'>;
export type NewGroup = Omit<LivestockGroup, 'id' | 'archivedOn' | 'archiveReason'>;
export type FarmPatch = Partial<NewFarm>;
export type NewInvite = Omit<FarmInvite, 'id'>;
export type FieldPatch = Partial<Omit<Field, 'id' | 'farmId'>>;
export type NewMovement = Omit<GroupMovement, 'id'>;
/** The current field only changes through recordMovement, so history is never skipped. */
export type GroupPatch = Partial<
  Omit<LivestockGroup, 'id' | 'farmId' | 'species' | 'currentFieldId'>
>;

/**
 * Storage for farms, fields, livestock groups and their movements (FR-2).
 * Every record carries a farmId (FR-2.7) so access can be scoped per farm once auth lands.
 * Business rules live in farmService; this layer only stores and fetches.
 */
export interface FarmRepository {
  /** Creates the farm with `ownerId` as its OWNER, in one write (A13). */
  createFarm(input: NewFarm, ownerId: string): Promise<Farm>;
  getFarm(id: string): Promise<Farm | null>;
  /** Farms the user is a member of, sorted by name (FR-8.4). */
  listFarmsForUser(userId: string): Promise<Farm[]>;
  /** The user's role on the farm, or null if they are not a member. */
  getRole(farmId: string, userId: string): Promise<FarmRole | null>;
  /** Every farm, for the daily briefing job (FR-4.5). */
  listFarmIds(): Promise<string[]>;
  /** In the order they joined. */
  listMembers(farmId: string): Promise<Array<{ userId: string; role: FarmRole }>>;
  addMember(farmId: string, userId: string, role: FarmRole): Promise<void>;
  /** False if they aren't a member. */
  setMemberRole(farmId: string, userId: string, role: FarmRole): Promise<boolean>;
  removeMember(farmId: string, userId: string): Promise<boolean>;

  /** One invite per farm and email: inviting again replaces the role. */
  createInvite(input: NewInvite): Promise<FarmInvite>;
  getInvite(id: string): Promise<FarmInvite | null>;
  listInvitesForFarm(farmId: string): Promise<FarmInvite[]>;
  listInvitesForEmail(email: string): Promise<FarmInvite[]>;
  deleteInvite(id: string): Promise<boolean>;
  /** Null if there's no such farm. */
  updateFarm(id: string, patch: FarmPatch): Promise<Farm | null>;
  /** Deletes the farm and everything on it. */
  deleteFarm(id: string): Promise<boolean>;

  createField(input: NewField): Promise<Field>;
  getField(id: string): Promise<Field | null>;
  /** Sorted by name, archived ones included. */
  listFields(farmId: string): Promise<Field[]>;
  updateField(id: string, patch: FieldPatch): Promise<Field | null>;

  /** When the group starts in a field and `placedOn` is given, also records that first movement. */
  createGroup(input: NewGroup, placedOn: string | null): Promise<LivestockGroup>;
  getGroup(id: string): Promise<LivestockGroup | null>;
  /** Sorted by name, archived ones included. */
  listGroups(farmId: string): Promise<LivestockGroup[]>;
  updateGroup(id: string, patch: GroupPatch): Promise<LivestockGroup>;

  /** Stores the move and, when `setAsCurrent`, updates the group's current field in the same write. */
  recordMovement(input: NewMovement, setAsCurrent: boolean): Promise<GroupMovement>;
  /** Newest first by date; on the same date, the most recently recorded first. */
  listMovements(groupId: string): Promise<GroupMovement[]>;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Drops undefined keys, so a patch only touches what was given. */
const definedOnly = <T extends object>(patch: T): Partial<T> =>
  Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;

export class InMemoryFarmRepository implements FarmRepository {
  private farms = new Map<string, Farm>();
  private members: Array<{ farmId: string; userId: string; role: FarmRole }> = [];
  private fields = new Map<string, Field>();
  private groups = new Map<string, LivestockGroup>();
  private movements: Array<GroupMovement & { seq: number }> = [];
  private invites: FarmInvite[] = [];
  private seq = 0;

  constructor(private newId: () => string = randomUUID) {}

  async createFarm(input: NewFarm, ownerId: string) {
    const farm = { ...input, id: this.newId() };
    this.farms.set(farm.id, farm);
    this.members.push({ farmId: farm.id, userId: ownerId, role: 'OWNER' });
    return { ...farm };
  }

  async getFarm(id: string) {
    const farm = this.farms.get(id);
    return farm ? { ...farm } : null;
  }

  async listFarmsForUser(userId: string) {
    const farmIds = new Set(this.members.filter((m) => m.userId === userId).map((m) => m.farmId));
    return [...this.farms.values()]
      .filter((f) => farmIds.has(f.id))
      .sort(byName)
      .map((f) => ({ ...f }));
  }

  async getRole(farmId: string, userId: string) {
    return this.members.find((m) => m.farmId === farmId && m.userId === userId)?.role ?? null;
  }

  async listFarmIds() {
    return [...this.farms.keys()];
  }

  async listMembers(farmId: string) {
    return this.members
      .filter((m) => m.farmId === farmId)
      .map(({ userId, role }) => ({ userId, role }));
  }

  async addMember(farmId: string, userId: string, role: FarmRole) {
    this.members.push({ farmId, userId, role });
  }

  async setMemberRole(farmId: string, userId: string, role: FarmRole) {
    const member = this.members.find((m) => m.farmId === farmId && m.userId === userId);
    if (member) member.role = role;
    return Boolean(member);
  }

  async removeMember(farmId: string, userId: string) {
    const before = this.members.length;
    this.members = this.members.filter((m) => !(m.farmId === farmId && m.userId === userId));
    return this.members.length < before;
  }

  async createInvite(input: NewInvite) {
    const existing = this.invites.find((i) => i.farmId === input.farmId && i.email === input.email);
    if (existing) {
      Object.assign(existing, input);
      return { ...existing };
    }
    const invite = { ...input, id: this.newId() };
    this.invites.push(invite);
    return { ...invite };
  }

  async getInvite(id: string) {
    const invite = this.invites.find((i) => i.id === id);
    return invite ? { ...invite } : null;
  }

  async listInvitesForFarm(farmId: string) {
    return this.invites.filter((i) => i.farmId === farmId).map((i) => ({ ...i }));
  }

  async listInvitesForEmail(email: string) {
    return this.invites.filter((i) => i.email === email).map((i) => ({ ...i }));
  }

  async deleteInvite(id: string) {
    const before = this.invites.length;
    this.invites = this.invites.filter((i) => i.id !== id);
    return this.invites.length < before;
  }

  async updateFarm(id: string, patch: FarmPatch) {
    const farm = this.farms.get(id);
    if (!farm) return null;
    const updated = { ...farm, ...definedOnly(patch) };
    this.farms.set(id, updated);
    return { ...updated };
  }

  async deleteFarm(id: string) {
    if (!this.farms.delete(id)) return false;
    this.members = this.members.filter((m) => m.farmId !== id);
    this.invites = this.invites.filter((i) => i.farmId !== id);
    this.movements = this.movements.filter((m) => m.farmId !== id);
    for (const [key, field] of this.fields) if (field.farmId === id) this.fields.delete(key);
    for (const [key, group] of this.groups) if (group.farmId === id) this.groups.delete(key);
    return true;
  }

  async createField(input: NewField) {
    const field = { ...input, archivedOn: null, id: this.newId() };
    this.fields.set(field.id, field);
    return { ...field };
  }

  async getField(id: string) {
    const field = this.fields.get(id);
    return field ? { ...field } : null;
  }

  async listFields(farmId: string) {
    return [...this.fields.values()]
      .filter((f) => f.farmId === farmId)
      .sort(byName)
      .map((f) => ({ ...f }));
  }

  async updateField(id: string, patch: FieldPatch) {
    const field = this.fields.get(id);
    if (!field) return null;
    const updated = { ...field, ...definedOnly(patch) };
    this.fields.set(id, updated);
    return { ...updated };
  }

  async createGroup(input: NewGroup, placedOn: string | null) {
    const group = { ...input, archivedOn: null, archiveReason: null, id: this.newId() };
    this.groups.set(group.id, group);
    if (group.currentFieldId && placedOn) {
      this.pushMovement({
        farmId: group.farmId,
        groupId: group.id,
        fromFieldId: null,
        toFieldId: group.currentFieldId,
        movedOn: placedOn,
      });
    }
    return { ...group };
  }

  async getGroup(id: string) {
    const group = this.groups.get(id);
    return group ? { ...group } : null;
  }

  async listGroups(farmId: string) {
    return [...this.groups.values()]
      .filter((g) => g.farmId === farmId)
      .sort(byName)
      .map((g) => ({ ...g }));
  }

  async updateGroup(id: string, patch: GroupPatch) {
    const group = this.groups.get(id);
    if (!group) throw new Error(`Group ${id} not found`);
    const updated = { ...group, ...patch };
    this.groups.set(id, updated);
    return { ...updated };
  }

  async recordMovement(input: NewMovement, setAsCurrent: boolean) {
    const group = this.groups.get(input.groupId);
    if (!group) throw new Error(`Group ${input.groupId} not found`);
    const movement = this.pushMovement(input);
    if (setAsCurrent) this.groups.set(group.id, { ...group, currentFieldId: input.toFieldId });
    return movement;
  }

  async listMovements(groupId: string) {
    return this.movements
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => b.movedOn.localeCompare(a.movedOn) || b.seq - a.seq)
      .map(({ seq: _seq, ...m }) => m);
  }

  private pushMovement(input: NewMovement): GroupMovement {
    const movement = { ...input, id: this.newId() };
    this.movements.push({ ...movement, seq: ++this.seq });
    return movement;
  }
}

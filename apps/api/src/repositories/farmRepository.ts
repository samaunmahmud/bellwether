import { randomUUID } from 'node:crypto';
import type { Farm, FarmRole, Field, GroupMovement, LivestockGroup } from '../domain/farm';

export type NewFarm = Omit<Farm, 'id'>;
export type NewField = Omit<Field, 'id'>;
export type NewGroup = Omit<LivestockGroup, 'id'>;
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

  createField(input: NewField): Promise<Field>;
  getField(id: string): Promise<Field | null>;
  /** Sorted by name. */
  listFields(farmId: string): Promise<Field[]>;

  /** When the group starts in a field and `placedOn` is given, also records that first movement. */
  createGroup(input: NewGroup, placedOn: string | null): Promise<LivestockGroup>;
  getGroup(id: string): Promise<LivestockGroup | null>;
  /** Sorted by name. */
  listGroups(farmId: string): Promise<LivestockGroup[]>;
  updateGroup(id: string, patch: GroupPatch): Promise<LivestockGroup>;

  /** Stores the move and, when `setAsCurrent`, updates the group's current field in the same write. */
  recordMovement(input: NewMovement, setAsCurrent: boolean): Promise<GroupMovement>;
  /** Newest first by date; on the same date, the most recently recorded first. */
  listMovements(groupId: string): Promise<GroupMovement[]>;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export class InMemoryFarmRepository implements FarmRepository {
  private farms = new Map<string, Farm>();
  private members: Array<{ farmId: string; userId: string; role: FarmRole }> = [];
  private fields = new Map<string, Field>();
  private groups = new Map<string, LivestockGroup>();
  private movements: Array<GroupMovement & { seq: number }> = [];
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

  async createField(input: NewField) {
    const field = { ...input, id: this.newId() };
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

  async createGroup(input: NewGroup, placedOn: string | null) {
    const group = { ...input, id: this.newId() };
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

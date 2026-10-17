import { addDays } from '@bellwether/risk-engine';
import { londonToday } from '../dates';
import type { Farm, GroupMovement, LivestockGroup } from '../domain/farm';
import { farmStats, grazingFor, type RegisterEvent } from '../domain/register';
import type { Field } from '../domain/farm';
import type { FarmRepository } from '../repositories/farmRepository';
import type { RecordsRepository } from '../repositories/recordsRepository';
import type { TaskRepository } from '../repositories/briefingRepository';
import type { ForecastService } from './forecastService';
import type { LocationService } from './locationService';
import type { RecordsService } from './recordsService';
import { medicineStatus, type RegisterService } from './registerService';

export type AlertLevel = 'URGENT' | 'WARNING' | 'INFO';

export interface Alert {
  level: AlertLevel;
  title: string;
  detail: string;
  /** Path in the web app */
  link: string;
}

export interface ActivityItem {
  date: string;
  kind: string;
  title: string;
  detail: string | null;
  groupId: string | null;
  groupName: string | null;
}

export interface InsightsDeps {
  farms: FarmRepository;
  records: RecordsRepository;
  tasks: TaskRepository;
  recordsService: RecordsService;
  registerService: RegisterService;
  forecastService: ForecastService;
  locations: LocationService;
  now?: () => Date;
}

/** Days ahead that a withdrawal ending is worth a mention */
const WITHDRAWAL_NOTICE_DAYS = 7;
/** The annual inventory is taken on 1 December (holding register rules). TODO(verify source) */
const HEAD_COUNT_DAY = '12-01';
const HEAD_COUNT_NOTICE_DAYS = 14;
const RANK: Record<AlertLevel, number> = { URGENT: 0, WARNING: 1, INFO: 2 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function eventTitle(e: RegisterEvent): string {
  const n = e.count ?? 0;
  switch (e.kind) {
    case 'BIRTH':
      return `${n} born alive${e.bornDead ? `, ${e.bornDead} born dead` : ''}`;
    case 'DEATH':
      return `${n} died`;
    case 'MOVE_ON':
      return `${n} moved on from ${e.otherParty}`;
    case 'MOVE_OFF':
      return `${n} moved off to ${e.otherParty}`;
    case 'WEIGHING':
      return `Weighed ${n}: average ${e.value} kg`;
    case 'FEC':
      return `Egg count: ${e.value} eggs per gram`;
    case 'BODY_CONDITION':
      return `Condition score ${e.value}`;
    case 'TAG_REPLACEMENT':
      return `${plural(n, 'tag')} replaced`;
    case 'HEAD_COUNT':
      return `Head count: ${n}`;
  }
}

/** Dashboard figures, alerts, activity, grazing and weather for a farm (v3). */
export function createInsightsService(deps: InsightsDeps) {
  const now = deps.now ?? (() => new Date());
  const today = () => londonToday(now());

  const activeGroups = async (farmId: string) =>
    (await deps.farms.listGroups(farmId)).filter((g) => !g.archivedOn);

  async function allMoves(groups: LivestockGroup[]): Promise<GroupMovement[]> {
    return (await Promise.all(groups.map((g) => deps.farms.listMovements(g.id)))).flat();
  }

  return {
    async stats(farm: Farm) {
      const groups = await activeGroups(farm.id);
      const events = await deps.registerService.eventsForFarm(farm.id);
      const tasks = await deps.tasks.listTasks(farm.id);
      const withdrawals = await Promise.all(
        groups.map((g) => deps.recordsService.withdrawalFor(g.id)),
      );
      const open = tasks.filter((t) => !t.done);
      return {
        ...farmStats(groups, events, addDays(today(), -365)),
        groupsInWithdrawal: withdrawals.filter((w) => w.inWithdrawal).length,
        openTasks: open.length,
        overdueTasks: open.filter((t) => t.dueDate < today()).length,
      };
    },

    /** Most urgent first. */
    async alerts(farm: Farm): Promise<Alert[]> {
      const day = today();
      const alerts: Alert[] = [];
      const groups = await activeGroups(farm.id);
      const groupName = new Map(groups.map((g) => [g.id, g.name]));
      const where = (groupId: string | null) =>
        groupId ? (groupName.get(groupId) ?? 'A group') : 'Whole farm';

      for (const task of (await deps.tasks.listTasks(farm.id)).filter((t) => !t.done)) {
        if (task.dueDate < day)
          alerts.push({
            level: 'URGENT',
            title: `Overdue: ${task.title}`,
            detail: `Was due ${task.dueDate} · ${where(task.groupId)}`,
            link: `/farms/${farm.id}/tasks`,
          });
        else if (task.dueDate === day)
          alerts.push({
            level: 'WARNING',
            title: `Due today: ${task.title}`,
            detail: where(task.groupId),
            link: `/farms/${farm.id}/tasks`,
          });
      }

      for (const item of await deps.registerService.medicinesForFarm(farm.id)) {
        const status = medicineStatus(item, day);
        if (status === 'EXPIRED')
          alerts.push({
            level: 'URGENT',
            title: `Out of date: ${item.productName}`,
            detail: `Expired ${item.expiryDate}. Dispose of it safely.`,
            link: `/farms/${farm.id}/medicines`,
          });
        else if (status === 'EXPIRING')
          alerts.push({
            level: 'WARNING',
            title: `Expires soon: ${item.productName}`,
            detail: `Expires ${item.expiryDate}`,
            link: `/farms/${farm.id}/medicines`,
          });
      }

      for (const group of groups) {
        const w = await deps.recordsService.withdrawalFor(group.id);
        const ends = [w.meatEnds, w.milkEnds]
          .filter((d): d is string => d !== null)
          .sort()
          .at(-1);
        if (ends && ends <= addDays(day, WITHDRAWAL_NOTICE_DAYS))
          alerts.push({
            level: 'INFO',
            title: `Withdrawal ends: ${group.name}`,
            detail: `Clear after ${ends}`,
            link: `/groups/${group.id}`,
          });
      }

      const countDay = `${day.slice(0, 4)}-${HEAD_COUNT_DAY}`;
      const counted = (await deps.registerService.eventsForFarm(farm.id)).some(
        (e) => e.kind === 'HEAD_COUNT' && !e.voidedAt && e.date >= countDay,
      );
      if (!counted && day >= addDays(countDay, -HEAD_COUNT_NOTICE_DAYS))
        alerts.push({
          level: day >= countDay ? 'WARNING' : 'INFO',
          title: 'Annual head count',
          detail: 'Record the number of animals on the holding on 1 December.',
          link: `/farms/${farm.id}/register`,
        });

      return alerts.sort((a, b) => RANK[a.level] - RANK[b.level]);
    },

    /** Records, moves and register entries across the farm, newest first. */
    async activity(farm: Farm, limit: number): Promise<ActivityItem[]> {
      const groups = await deps.farms.listGroups(farm.id);
      const groupName = new Map(groups.map((g) => [g.id, g.name]));
      const fields = new Map((await deps.farms.listFields(farm.id)).map((f) => [f.id, f.name]));
      const item = (
        date: string,
        kind: string,
        title: string,
        detail: string | null,
        groupId: string | null,
      ): ActivityItem => ({
        date,
        kind,
        title,
        detail,
        groupId,
        groupName: groupId ? (groupName.get(groupId) ?? null) : null,
      });

      const events = (await deps.registerService.eventsForFarm(farm.id))
        .filter((e) => !e.voidedAt)
        .map((e) =>
          item(
            e.date,
            e.kind,
            eventTitle(e),
            e.cause ?? e.note ?? `Recorded by ${e.recordedBy}`,
            e.groupId,
          ),
        );
      const treatments = (
        await deps.records.listFarmTreatments(farm.id, addDays(today(), -365), today())
      )
        .filter((t) => !t.voidedAt)
        .map((t) =>
          item(
            t.date,
            'TREATMENT',
            `Treated ${t.animalsTreated} with ${t.productName}`,
            `Given by ${t.administeredBy}`,
            t.groupId,
          ),
        );
      const checks = (await Promise.all(groups.map((g) => deps.records.listObservations(g.id))))
        .flat()
        .filter((o) => !o.voidedAt)
        .map((o) => item(o.date, 'CHECK', o.type, o.note, o.groupId));
      const moves = (await allMoves(groups)).map((m) =>
        item(
          m.movedOn,
          'MOVE',
          `Moved to ${fields.get(m.toFieldId) ?? 'a field'}`,
          null,
          m.groupId,
        ),
      );

      // Stable sort keeps each source's own newest-first order within a day.
      return [...treatments, ...events, ...checks, ...moves]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);
    },

    /** How long each field has been grazed or rested (v3 grazing rotation). */
    async grazing(field: Field) {
      const groups = await activeGroups(field.farmId);
      const inField = groups.filter((g) => g.currentFieldId === field.id && !g.housed);
      return grazingFor(
        field.id,
        inField.map((g) => g.name),
        await allMoves(groups),
        today(),
      );
    },

    async location(farm: Farm) {
      const { latitude, longitude } = await deps.locations.findPostcode(farm.postcode);
      return { latitude, longitude };
    },

    async weather(farm: Farm) {
      const { latitude, longitude } = await deps.locations.findPostcode(farm.postcode);
      return deps.forecastService.getWeatherAt(latitude, longitude);
    },
  };
}

export type InsightsService = ReturnType<typeof createInsightsService>;

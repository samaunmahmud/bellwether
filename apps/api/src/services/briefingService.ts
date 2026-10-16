import { addDays, getRiskModules } from '@bellwether/risk-engine';
import { londonToday } from '../dates';
import { buildBriefing, type BriefingContent, type GroupForBriefing } from '../domain/briefing';
import { toGroupContext } from '../domain/groupContext';
import { appError } from '../errors';
import type { Logger } from '../logger';
import type { BriefingRepository } from '../repositories/briefingRepository';
import type { FarmService } from './farmService';
import type { ForecastService } from './forecastService';

const NO_CHECKS = { MEDIUM: [], HIGH: [] };

export interface BriefingView extends BriefingContent {
  /** True when this is an earlier day's briefing, shown because today's couldn't be made */
  isStale: boolean;
}

export interface BriefingServiceDeps {
  farmService: FarmService;
  forecastService: ForecastService;
  briefings: BriefingRepository;
  logger: Logger;
  now?: () => Date;
}

/** Generates, stores and serves farm briefings (FR-4.1 to FR-4.5). */
export function createBriefingService(deps: BriefingServiceDeps) {
  const { farmService, forecastService, briefings } = deps;
  const now = deps.now ?? (() => new Date());

  async function groupsFor(farmId: string): Promise<GroupForBriefing[]> {
    const groups = await farmService.listGroups(farmId);
    return Promise.all(
      groups.map(async (group) => {
        const location = await farmService.locateGroup(group);
        const forecast = await forecastService.getGroupForecastAt(
          location.latitude,
          location.longitude,
          toGroupContext(group),
        );
        const field = group.currentFieldId
          ? await farmService.getField(group.currentFieldId)
          : null;
        return {
          groupId: group.id,
          groupName: group.name,
          fieldName: group.housed ? 'Housed' : (field?.name ?? null),
          risks: forecast.risks.map((risk) => ({
            riskId: risk.riskId,
            riskName: risk.name,
            days: risk.days,
            checks: getRiskModules().find((m) => m.id === risk.riskId)?.checks ?? NO_CHECKS,
          })),
        };
      }),
    );
  }

  /** FR-4.5: builds today's briefing for a farm and stores it. Throws if the weather is unavailable. */
  async function generate(farmId: string): Promise<BriefingContent> {
    const date = londonToday(now());
    const content = buildBriefing({
      date,
      generatedAt: now().toISOString(),
      groups: await groupsFor(farmId),
      previous: await briefings.getRun(farmId, addDays(date, -1)),
    });
    await briefings.saveRun(farmId, content);
    return content;
  }

  async function requireFarm(userId: string, farmId: string) {
    if (!(await farmService.getFarm(userId, farmId)))
      throw appError('NOT_FOUND', `Farm ${farmId} not found`);
  }

  return {
    generate,

    /**
     * Today's stored briefing, made now if there isn't one yet. If it can't be made, the last
     * successful briefing is returned and marked stale (reliability requirement).
     */
    async briefingFor(userId: string, farmId: string): Promise<BriefingView | null> {
      if (!(await farmService.getFarm(userId, farmId))) return null;
      const today = londonToday(now());
      const stored = await briefings.getRun(farmId, today);
      if (stored) return { ...stored, isStale: false };

      try {
        return { ...(await generate(farmId)), isStale: false };
      } catch (err) {
        deps.logger.warn(`briefing for farm ${farmId} not generated: ${(err as Error).message}`);
        const latest = await briefings.latestRun(farmId);
        if (latest) return { ...latest, isStale: true };
        throw appError(
          'UPSTREAM_UNAVAILABLE',
          'The briefing is unavailable right now because the weather forecast could not be fetched.',
        );
      }
    },

    async refresh(userId: string, farmId: string): Promise<BriefingView> {
      await requireFarm(userId, farmId);
      try {
        return { ...(await generate(farmId)), isStale: false };
      } catch {
        throw appError('UPSTREAM_UNAVAILABLE', 'Weather forecast is unavailable right now.');
      }
    },
  };
}

export type BriefingService = ReturnType<typeof createBriefingService>;

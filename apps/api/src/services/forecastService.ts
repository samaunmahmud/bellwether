import {
  addDays,
  getRiskModules,
  historyRangeFor,
  modulesForGroup,
  type AnimalCategory,
  type DailyRisk,
  type DailyWeather,
  type DateRange,
  type GroupContext,
  type RiskContext,
  type RiskModule,
} from '@bellwether/risk-engine';
import { getOrLoad, TTL, type Cache } from '../cache/cache';
import type { Location } from '../clients/postcodesClient';
import type { WeatherClient } from '../clients/weatherClient';
import { appError } from '../errors';
import type { Logger } from '../logger';
import { londonToday } from '../dates';
import type { LocationService } from './locationService';

export interface RiskForecast {
  riskId: string;
  name: string;
  category: AnimalCategory;
  animals: string[];
  days: DailyRisk[];
}

export interface Forecast {
  location: Location;
  generatedAt: string;
  risks: RiskForecast[];
}

export interface ForecastDeps {
  locations: LocationService;
  weather: WeatherClient;
  cache: Cache;
  logger: Logger;
  now?: () => Date;
}

/** Open-Meteo's archive (ERA5) runs about this many days behind. */
export const ARCHIVE_DELAY_DAYS = 5;
/** Past weather is cached for a week; the season-level results it feeds update weekly (FR-3.3). */
const HISTORY_TTL_SECONDS = 8 * 24 * 60 * 60;

/**
 * The part of `range` the archive can supply on `today`, ending on a Sunday so the request
 * (and its cache key) only changes once a week. Null if nothing is available yet.
 */
export function archiveRange(range: DateRange, today: string): DateRange | null {
  const latest = addDays(today, -ARCHIVE_DELAY_DAYS);
  const dayOfWeek = new Date(`${latest}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const lastSunday = addDays(latest, -dayOfWeek);
  const end = range.end < lastSunday ? range.end : lastSunday;
  return end >= range.start ? { start: range.start, end } : null;
}

export function createForecastService(deps: ForecastDeps) {
  const now = deps.now ?? (() => new Date());

  async function forecastDays(latitude: number, longitude: number): Promise<DailyWeather[]> {
    // Round to ~1km so nearby locations share a cached forecast.
    const lat = latitude.toFixed(2);
    const lon = longitude.toFixed(2);
    try {
      return await getOrLoad(
        deps.cache,
        `weather:${lat}:${lon}`,
        TTL.weather,
        () => deps.weather.getDailyForecast(Number(lat), Number(lon)),
        deps.logger,
      );
    } catch {
      throw appError(
        'UPSTREAM_UNAVAILABLE',
        'Weather forecast is unavailable right now. Please try again.',
      );
    }
  }

  /** Past weather for the modules that need it. Failures are logged, not fatal: those modules just won't apply. */
  async function pastDays(
    latitude: number,
    longitude: number,
    candidates: RiskModule[],
    days: DailyWeather[],
  ): Promise<DailyWeather[]> {
    const first = days[0]?.date;
    const wanted = first ? historyRangeFor(candidates, first) : null;
    const range = wanted ? archiveRange(wanted, londonToday(now())) : null;
    if (!range) return [];

    const lat = latitude.toFixed(2);
    const lon = longitude.toFixed(2);
    try {
      return await getOrLoad(
        deps.cache,
        `history:${lat}:${lon}:${range.start}:${range.end}`,
        HISTORY_TTL_SECONDS,
        () => deps.weather.getHistory(Number(lat), Number(lon), range),
        deps.logger,
      );
    } catch (err) {
      deps.logger.warn(`past weather unavailable: ${(err as Error).message}`);
      return [];
    }
  }

  const assess = (modules: RiskModule[], days: DailyWeather[], ctx: RiskContext) =>
    modules.map((module) => ({
      riskId: module.id,
      name: module.name,
      category: module.category,
      animals: module.animals,
      days: module.assess(days, ctx),
    }));

  return {
    async getForecast(
      rawPostcode: string,
      category: AnimalCategory,
      ctx: RiskContext = {},
    ): Promise<Forecast> {
      const location = await deps.locations.findPostcode(rawPostcode);
      const days = await forecastDays(location.latitude, location.longitude);
      // Modules that need a group or past weather (e.g. lamb chill, fluke) drop out here.
      const modules = getRiskModules(category).filter((m) => m.appliesTo?.(ctx, days) ?? true);
      return { location, generatedAt: now().toISOString(), risks: assess(modules, days, ctx) };
    },

    /** FR-3.0: risks for one livestock group at a point (e.g. a field pin), using its details. */
    async getGroupForecastAt(latitude: number, longitude: number, group: GroupContext) {
      const days = await forecastDays(latitude, longitude);
      const candidates = getRiskModules('farm').filter((m) => m.animals.includes(group.species));
      const history = await pastDays(latitude, longitude, candidates, days);
      const ctx: RiskContext = { group, history };
      const risks = assess(modulesForGroup({ ...ctx, group }, days), days, ctx);
      return { generatedAt: now().toISOString(), risks };
    },
  };
}

export type ForecastService = ReturnType<typeof createForecastService>;

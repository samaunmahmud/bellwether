import {
  getRiskModules,
  type AnimalCategory,
  type DailyRisk,
  type RiskContext,
  type RiskModule,
} from '@bellwether/risk-engine';
import { getOrLoad, TTL, type Cache } from '../cache/cache';
import type { Location } from '../clients/postcodesClient';
import type { WeatherClient } from '../clients/weatherClient';
import type { Species } from '../domain/farm';
import { appError } from '../errors';
import type { Logger } from '../logger';
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

/** Farm risk modules that apply to a species, e.g. 'SHEEP' → modules whose animals include 'sheep'. */
export function modulesForSpecies(species: Species): RiskModule[] {
  const animal = species.toLowerCase();
  return getRiskModules('farm').filter((m) => m.animals.includes(animal));
}

export function createForecastService(deps: ForecastDeps) {
  const now = deps.now ?? (() => new Date());

  async function assessAt(
    latitude: number,
    longitude: number,
    modules: RiskModule[],
    ctx: RiskContext,
  ): Promise<RiskForecast[]> {
    // Round to ~1km so nearby locations share a cached forecast.
    const lat = latitude.toFixed(2);
    const lon = longitude.toFixed(2);

    let days;
    try {
      days = await getOrLoad(
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

    return modules.map((module) => ({
      riskId: module.id,
      name: module.name,
      category: module.category,
      animals: module.animals,
      days: module.assess(days, ctx),
    }));
  }

  return {
    async getForecast(
      rawPostcode: string,
      category: AnimalCategory,
      ctx: RiskContext = {},
    ): Promise<Forecast> {
      const location = await deps.locations.findPostcode(rawPostcode);
      const risks = await assessAt(
        location.latitude,
        location.longitude,
        getRiskModules(category),
        ctx,
      );
      return { location, generatedAt: now().toISOString(), risks };
    },

    /** Risks for one species at a point (e.g. a field pin). */
    async getSpeciesForecastAt(latitude: number, longitude: number, species: Species) {
      const risks = await assessAt(latitude, longitude, modulesForSpecies(species), {});
      return { generatedAt: now().toISOString(), risks };
    },
  };
}

export type ForecastService = ReturnType<typeof createForecastService>;

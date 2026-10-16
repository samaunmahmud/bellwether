import {
  getRiskModules,
  type AnimalCategory,
  type DailyRisk,
  type RiskContext,
} from '@bellwether/risk-engine';
import { getOrLoad, TTL, type Cache } from '../cache/cache';
import type { Location, PostcodeClient } from '../clients/postcodesClient';
import type { WeatherClient } from '../clients/weatherClient';
import { appError } from '../errors';
import type { Logger } from '../logger';
import { normalisePostcode } from '../postcode';

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
  postcodes: PostcodeClient;
  weather: WeatherClient;
  cache: Cache;
  logger: Logger;
  now?: () => Date;
}

export function createForecastService(deps: ForecastDeps) {
  const now = deps.now ?? (() => new Date());

  async function findLocation(rawPostcode: string): Promise<Location> {
    const postcode = normalisePostcode(rawPostcode);
    if (!postcode)
      throw appError('INVALID_POSTCODE', `"${rawPostcode}" is not a valid UK postcode`);

    let location: Location | null;
    try {
      location = await getOrLoad(
        deps.cache,
        `postcode:${postcode}`,
        TTL.postcode,
        () => deps.postcodes.lookup(postcode),
        deps.logger,
      );
    } catch {
      throw appError(
        'UPSTREAM_UNAVAILABLE',
        'Postcode lookup is unavailable right now. Please try again.',
      );
    }
    if (!location) throw appError('POSTCODE_NOT_FOUND', `Postcode ${postcode} was not found`);
    return location;
  }

  return {
    async getForecast(
      rawPostcode: string,
      category: AnimalCategory,
      ctx: RiskContext = {},
    ): Promise<Forecast> {
      const location = await findLocation(rawPostcode);

      // Round to ~1km so nearby postcodes share a cached forecast.
      const lat = location.latitude.toFixed(2);
      const lon = location.longitude.toFixed(2);

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

      const risks = getRiskModules(category).map((module) => ({
        riskId: module.id,
        name: module.name,
        category: module.category,
        animals: module.animals,
        days: module.assess(days, ctx),
      }));

      return { location, generatedAt: now().toISOString(), risks };
    },
  };
}

export type ForecastService = ReturnType<typeof createForecastService>;

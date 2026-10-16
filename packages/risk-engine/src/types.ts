export type AnimalCategory = 'pet' | 'farm';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** One hour of weather, in UK local time. */
export interface HourlyWeather {
  /** Local ISO date-time, e.g. "2026-06-01T15:00" */
  time: string;
  tempC: number;
  humidityPct: number;
  windSpeedMs: number;
  precipitationMm: number;
}

export interface DailyWeather {
  /** ISO date, e.g. "2026-10-15" */
  date: string;
  tempMeanC: number;
  tempMaxC: number;
  tempMinC: number;
  humidityMeanPct: number;
  precipitationMm: number;
  // FR-3.0: optional extras. Modules must still work when they are missing.
  /** Mean wind speed at 10 m, m/s */
  windSpeedMeanMs?: number;
  /** FAO reference evapotranspiration, mm/day */
  et0Mm?: number;
  /** Mean soil temperature near the surface, °C */
  soilTempMeanC?: number;
  /** The day's hours, when hourly data is available */
  hours?: HourlyWeather[];
}

export type Species = 'cattle' | 'sheep';

/** FR-3.0: what we know about a livestock group. Dates are ISO (YYYY-MM-DD). */
export interface GroupContext {
  species: Species;
  /** e.g. 'EWES', 'LAMBS', 'DAIRY_COWS' */
  livestockClass?: string;
  housed?: boolean;
  lastShearingDate?: string | null;
  lambingStart?: string | null;
  lambingEnd?: string | null;
  lambsAtGrassThisSpring?: boolean;
}

export interface RiskContext {
  /** Pet regularly walks in long grass or woodland */
  highExposureHabitat?: boolean;
  /** FR-3.0: the livestock group being assessed */
  group?: GroupContext;
  /** FR-3.0: observed weather before the forecast, oldest first */
  history?: DailyWeather[];
}

export interface DailyRisk {
  date: string;
  level: RiskLevel;
  /** 0–100, used for charts */
  score: number;
  /** Plain-English explanation of why this level was given */
  reason: string;
}

export interface RiskModule {
  id: string;
  name: string;
  category: AnimalCategory;
  animals: string[];
  assess(days: DailyWeather[], ctx?: RiskContext): DailyRisk[];
  /** FR-3.0: false when the module doesn't apply to this group or period (default: applies). */
  appliesTo?(ctx: RiskContext, days: DailyWeather[]): boolean;
  /** FR-3.0: the past weather this module needs, given the first forecast day (default: none). */
  historyRange?(firstForecastDay: string): DateRange | null;
}

export interface DateRange {
  /** Inclusive ISO dates */
  start: string;
  end: string;
}

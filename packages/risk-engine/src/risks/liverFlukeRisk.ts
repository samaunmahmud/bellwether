import { addDays } from '../dates';
import { clampScore } from '../levels';
import type { DailyRisk, DailyWeather, RiskContext, RiskLevel, RiskModule } from '../types';

/*
 * FR-3.3: liver fluke season risk, using the Ollerenshaw index.
 *
 * For each month of the May–October season:   Mt = n × (R − P + 5)
 * n = rain days, R = rainfall, P = potential evapotranspiration, with R and P in inches
 * as in the original Anglesey work (Ollerenshaw & Rowlands, Veterinary Record, 1959).
 * Each month is capped (wet enough for the mud snail and parasite), and the monthly
 * values are summed into a season index.
 *
 * Caps, rain-day threshold and bands follow the operational version published by
 * Met Éireann; the bands also match Fox et al. 2011 (PLoS ONE, "Predicting impacts of
 * climate change on Fasciola hepatica risk").
 * TODO(verify source): the equation was read from secondary sources, not the 1959 paper.
 *
 * Fox et al.'s 10 °C monthly-temperature rule is not applied (docs/decisions.md).
 */
export const FLUKE_RAIN_DAY_MM = 0.2; // heuristic TODO(verify source)
const MM_PER_INCH = 25.4;
export const FLUKE_CONSTANT = 5; // heuristic TODO(verify source)
export const FLUKE_MONTH_CAP = 100; // heuristic TODO(verify source)
/** May and October are cooler, so snail development is slower. */
export const FLUKE_SHOULDER_MONTH_CAP = 50; // heuristic TODO(verify source)
const SEASON_FIRST_MONTH = 5; // May
const SEASON_LAST_MONTH = 10; // October
const SHOULDER_MONTHS = [5, 10];
// Bands for the season total. heuristic TODO(verify source)
export const FLUKE_MEDIUM = 300;
export const FLUKE_HIGH = 400; // HIGH when above this
/** The largest possible season total (50 + 4 × 100 + 50), used for the chart score. */
const FLUKE_SEASON_MAX = 500;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface MonthWeather {
  /** 1–12 */
  month: number;
  rainDays: number;
  rainMm: number;
  petMm: number;
}

export function monthlyFlukeValue({ month, rainDays, rainMm, petMm }: MonthWeather): number {
  const cap = SHOULDER_MONTHS.includes(month) ? FLUKE_SHOULDER_MONTH_CAP : FLUKE_MONTH_CAP;
  const value = rainDays * ((rainMm - petMm) / MM_PER_INCH + FLUKE_CONSTANT);
  return Math.min(cap, Math.max(0, value));
}

export function flukeLevel(index: number): RiskLevel {
  if (index < FLUKE_MEDIUM) return 'LOW';
  return index <= FLUKE_HIGH ? 'MEDIUM' : 'HIGH';
}

/** The season that matters on a date: this year's once May is complete, else last year's. */
export function flukeSeasonYear(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month > SEASON_FIRST_MONTH ? year : year - 1;
}

export interface SeasonIndex {
  index: number;
  /** Complete season months included, e.g. ['May', 'Jun'] */
  months: string[];
  /** True when all six months are included */
  complete: boolean;
  rainDays: number;
  rainMm: number;
  petMm: number;
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Sums the monthly values for the complete May–October months of `year` found in `history`. */
export function seasonFlukeIndex(history: DailyWeather[], year: number): SeasonIndex {
  const result: SeasonIndex = {
    index: 0,
    months: [],
    complete: false,
    rainDays: 0,
    rainMm: 0,
    petMm: 0,
  };

  for (let month = SEASON_FIRST_MONTH; month <= SEASON_LAST_MONTH; month++) {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const days = history.filter(
      (d): d is DailyWeather & { et0Mm: number } =>
        d.date.startsWith(prefix) && d.et0Mm !== undefined,
    );
    if (days.length < daysInMonth(year, month)) continue;

    const weather: MonthWeather = {
      month,
      rainDays: days.filter((d) => d.precipitationMm >= FLUKE_RAIN_DAY_MM).length,
      rainMm: days.reduce((sum, d) => sum + d.precipitationMm, 0),
      petMm: days.reduce((sum, d) => sum + d.et0Mm, 0),
    };
    result.index += monthlyFlukeValue(weather);
    result.months.push(MONTH_NAMES[month - 1]!);
    result.rainDays += weather.rainDays;
    result.rainMm += weather.rainMm;
    result.petMm += weather.petMm;
  }

  result.complete = result.months.length === SEASON_LAST_MONTH - SEASON_FIRST_MONTH + 1;
  return result;
}

const OUTCOME: Record<RiskLevel, string> = {
  LOW: 'low fluke risk',
  MEDIUM: 'moderate fluke risk',
  HIGH: 'high fluke risk',
};

function seasonFor(days: DailyWeather[], ctx: RiskContext): SeasonIndex | null {
  const first = days[0]?.date;
  if (!first || !ctx.history?.length) return null;
  const season = seasonFlukeIndex(ctx.history, flukeSeasonYear(first));
  return season.months.length > 0 ? season : null;
}

function describe(season: SeasonIndex, year: number): { level: RiskLevel; reason: string } {
  const level = flukeLevel(season.index);
  const first = season.months[0]!;
  const last = season.months.at(-1)!;
  const span = first === last ? first : `${first}–${last}`;
  const soFar = season.complete ? '' : ' so far';
  const reason =
    `Fluke season index ${Math.round(season.index)} from ${span} ${year} weather${soFar} ` +
    `(${Math.round(season.rainMm)} mm rain on ${season.rainDays} days, ` +
    `${Math.round(season.petMm)} mm evaporation): ` +
    `${OUTCOME[level]}${soFar} this season`;
  return { level, reason };
}

export const liverFlukeRisk: RiskModule = {
  id: 'liver-fluke',
  name: 'Liver fluke season',
  category: 'farm',
  animals: ['sheep', 'cattle'],
  /** Season-level: every forecast day gets the same result. */
  assess(days, ctx = {}) {
    const season = seasonFor(days, ctx);
    const result = season
      ? describe(season, flukeSeasonYear(days[0]!.date))
      : {
          level: 'LOW' as const,
          reason: 'Not enough past weather to estimate the fluke season',
        };
    const score = season ? clampScore((season.index / FLUKE_SEASON_MAX) * 100) : 0;
    return days.map((day): DailyRisk => ({ date: day.date, score, ...result }));
  },
  appliesTo(ctx, days) {
    return seasonFor(days, ctx) !== null;
  },
  historyRange(firstForecastDay) {
    const year = flukeSeasonYear(firstForecastDay);
    const seasonEnd = `${year}-${SEASON_LAST_MONTH}-31`;
    const dayBefore = addDays(firstForecastDay, -1);
    return {
      start: `${year}-0${SEASON_FIRST_MONTH}-01`,
      end: dayBefore < seasonEnd ? dayBefore : seasonEnd,
    };
  },
};

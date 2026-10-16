import type { DailyWeather, DateRange, HourlyWeather } from '@bellwether/risk-engine';

export interface WeatherClient {
  /** 14-day forecast, with hourly detail where available. Throws when the service is unavailable. */
  getDailyForecast(latitude: number, longitude: number): Promise<DailyWeather[]>;
  /** Observed daily weather for a past date range (FR-3.0). Throws when the service is unavailable. */
  getHistory(latitude: number, longitude: number, range: DateRange): Promise<DailyWeather[]>;
}

export const FORECAST_DAYS = 14;

// Field names checked against the Open-Meteo docs (open-meteo.com/en/docs) in October 2026.
// TODO(verify): `relative_humidity_2m_mean` and `temperature_2m_mean` are not listed by name there.
const DAILY_FIELDS = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'relative_humidity_2m_mean',
  'precipitation_sum',
  'et0_fao_evapotranspiration',
] as const;

const HOURLY_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
  'precipitation',
  'soil_temperature_6cm',
] as const;

type Series = Array<number | null>;

interface OpenMeteoResponse {
  daily?: { time: string[] } & Partial<Record<(typeof DAILY_FIELDS)[number], Series>>;
  hourly?: { time: string[] } & Partial<Record<(typeof HOURLY_FIELDS)[number], Series>>;
}

const at = (series: Series | undefined, i: number) => series?.[i] ?? 0;

function mean(values: Array<number | null | undefined>): number | undefined {
  const present = values.filter((v): v is number => typeof v === 'number');
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : undefined;
}

/** Groups hourly series by local date, returning each day's hours and its wind and soil means. */
function hourlyByDate(hourly: NonNullable<OpenMeteoResponse['hourly']>) {
  const byDate = new Map<string, { hours: HourlyWeather[]; soil: Array<number | null> }>();
  hourly.time.forEach((time, i) => {
    const date = time.slice(0, 10);
    const entry = byDate.get(date) ?? { hours: [], soil: [] };
    entry.hours.push({
      time,
      tempC: at(hourly.temperature_2m, i),
      humidityPct: at(hourly.relative_humidity_2m, i),
      windSpeedMs: at(hourly.wind_speed_10m, i),
      precipitationMm: at(hourly.precipitation, i),
    });
    entry.soil.push(hourly.soil_temperature_6cm?.[i] ?? null);
    byDate.set(date, entry);
  });
  return byDate;
}

function toDailyWeather(body: OpenMeteoResponse): DailyWeather[] {
  const d = body.daily;
  if (!d) throw new Error('Open-Meteo response missing daily data');
  const hours = body.hourly ? hourlyByDate(body.hourly) : new Map();

  return d.time.map((date, i) => {
    const day: DailyWeather = {
      date,
      tempMeanC: at(d.temperature_2m_mean, i),
      tempMaxC: at(d.temperature_2m_max, i),
      tempMinC: at(d.temperature_2m_min, i),
      humidityMeanPct: at(d.relative_humidity_2m_mean, i),
      precipitationMm: at(d.precipitation_sum, i),
    };
    const et0 = d.et0_fao_evapotranspiration?.[i];
    if (typeof et0 === 'number') day.et0Mm = et0;

    const hourly = hours.get(date);
    if (hourly) {
      day.hours = hourly.hours;
      day.windSpeedMeanMs = mean(hourly.hours.map((h: HourlyWeather) => h.windSpeedMs));
      const soil = mean(hourly.soil);
      if (soil !== undefined) day.soilTempMeanC = soil;
    }
    return day;
  });
}

/**
 * Client for Open-Meteo: the forecast API, and the archive API for past weather.
 * Wind is requested in m/s; all times are UK local time.
 */
export function createOpenMeteoClient(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  archiveBaseUrl = 'https://archive-api.open-meteo.com',
): WeatherClient {
  async function get(url: string): Promise<DailyWeather[]> {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    return toDailyWeather((await res.json()) as OpenMeteoResponse);
  }

  return {
    getDailyForecast(latitude, longitude) {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        daily: DAILY_FIELDS.join(','),
        hourly: HOURLY_FIELDS.join(','),
        forecast_days: String(FORECAST_DAYS),
        wind_speed_unit: 'ms',
        timezone: 'Europe/London',
      });
      return get(`${baseUrl}/v1/forecast?${params.toString()}`);
    },

    getHistory(latitude, longitude, range) {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        start_date: range.start,
        end_date: range.end,
        daily: DAILY_FIELDS.join(','),
        timezone: 'Europe/London',
      });
      return get(`${archiveBaseUrl}/v1/archive?${params.toString()}`);
    },
  };
}

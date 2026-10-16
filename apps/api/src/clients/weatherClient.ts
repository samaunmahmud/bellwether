import type { DailyWeather } from '@bellwether/risk-engine';

export interface WeatherClient {
  /** 14-day daily forecast. Throws when the service is unavailable. */
  getDailyForecast(latitude: number, longitude: number): Promise<DailyWeather[]>;
}

export const FORECAST_DAYS = 14;

const DAILY_FIELDS = [
  'temperature_2m_mean',
  'temperature_2m_max',
  'temperature_2m_min',
  'relative_humidity_2m_mean',
  'precipitation_sum',
] as const;

interface OpenMeteoResponse {
  daily?: {
    time: string[];
    temperature_2m_mean: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    relative_humidity_2m_mean: number[];
    precipitation_sum: number[];
  };
}

/** Client for the Open-Meteo forecast API. TODO(verify): re-check daily field names against current docs. */
export function createOpenMeteoClient(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): WeatherClient {
  return {
    async getDailyForecast(latitude, longitude) {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        daily: DAILY_FIELDS.join(','),
        forecast_days: String(FORECAST_DAYS),
        timezone: 'Europe/London',
      });
      const res = await fetchFn(`${baseUrl}/v1/forecast?${params.toString()}`);
      if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);

      const body = (await res.json()) as OpenMeteoResponse;
      const d = body.daily;
      if (!d) throw new Error('Open-Meteo response missing daily data');

      return d.time.map((date, i) => ({
        date,
        tempMeanC: d.temperature_2m_mean[i] ?? 0,
        tempMaxC: d.temperature_2m_max[i] ?? 0,
        tempMinC: d.temperature_2m_min[i] ?? 0,
        humidityMeanPct: d.relative_humidity_2m_mean[i] ?? 0,
        precipitationMm: d.precipitation_sum[i] ?? 0,
      }));
    },
  };
}

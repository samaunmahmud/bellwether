import { describe, expect, it, vi } from 'vitest';
import { createPostcodesIoClient } from '../src/clients/postcodesClient';
import { createOpenMeteoClient } from '../src/clients/weatherClient';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('postcodes.io client', () => {
  it('maps a successful response to a Location', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 200,
        result: {
          postcode: 'UB8 3PH',
          latitude: 51.53,
          longitude: -0.47,
          region: 'London',
          admin_district: 'Hillingdon',
        },
      }),
    );
    const client = createPostcodesIoClient('https://pc.test', fetchFn);

    await expect(client.lookup('UB8 3PH')).resolves.toEqual({
      postcode: 'UB8 3PH',
      latitude: 51.53,
      longitude: -0.47,
      region: 'London',
    });
    expect(fetchFn).toHaveBeenCalledWith('https://pc.test/postcodes/UB8%203PH');
  });

  it('falls back to admin_district when region is missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 200,
        result: {
          postcode: 'X',
          latitude: 1,
          longitude: 2,
          region: null,
          admin_district: 'Glasgow City',
        },
      }),
    );
    const result = await createPostcodesIoClient('https://pc.test', fetchFn).lookup('X');
    expect(result?.region).toBe('Glasgow City');
  });

  it('returns null for unknown postcodes (404) or missing coordinates', async () => {
    const notFound = vi.fn().mockResolvedValue(jsonResponse({ status: 404 }, 404));
    expect(await createPostcodesIoClient('https://pc.test', notFound).lookup('ZZ1 1ZZ')).toBeNull();

    const noCoords = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 200,
        result: {
          postcode: 'X',
          latitude: null,
          longitude: null,
          region: null,
          admin_district: null,
        },
      }),
    );
    expect(await createPostcodesIoClient('https://pc.test', noCoords).lookup('X')).toBeNull();
  });

  it('throws when the service fails', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(createPostcodesIoClient('https://pc.test', fetchFn).lookup('X')).rejects.toThrow(
      '500',
    );
  });
});

describe('Open-Meteo client', () => {
  it('requests 14 days and maps daily arrays into DailyWeather', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        daily: {
          time: ['2026-06-01', '2026-06-02'],
          temperature_2m_mean: [12, 14],
          temperature_2m_max: [16, 19],
          temperature_2m_min: [8, 9],
          relative_humidity_2m_mean: [80, 75],
          precipitation_sum: [0, 3.2],
        },
      }),
    );
    const days = await createOpenMeteoClient('https://wx.test', fetchFn).getDailyForecast(
      51.53,
      -0.47,
    );

    expect(days).toEqual([
      {
        date: '2026-06-01',
        tempMeanC: 12,
        tempMaxC: 16,
        tempMinC: 8,
        humidityMeanPct: 80,
        precipitationMm: 0,
      },
      {
        date: '2026-06-02',
        tempMeanC: 14,
        tempMaxC: 19,
        tempMinC: 9,
        humidityMeanPct: 75,
        precipitationMm: 3.2,
      },
    ]);
    const url = new URL(fetchFn.mock.calls[0]![0] as string);
    expect(url.searchParams.get('forecast_days')).toBe('14');
    expect(url.searchParams.get('latitude')).toBe('51.53');
  });

  it('adds hourly weather, daily wind and soil means, and ET0 when present (FR-3.0)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        daily: {
          time: ['2026-06-01'],
          temperature_2m_mean: [12],
          temperature_2m_max: [16],
          temperature_2m_min: [8],
          relative_humidity_2m_mean: [80],
          precipitation_sum: [0],
          et0_fao_evapotranspiration: [3.1],
        },
        hourly: {
          time: ['2026-06-01T00:00', '2026-06-01T01:00', '2026-06-02T00:00'],
          temperature_2m: [9, 8.5, 10],
          relative_humidity_2m: [90, 92, 85],
          wind_speed_10m: [2, 4, 6],
          precipitation: [0, 0.2, 0],
          soil_temperature_6cm: [11, 13, null],
        },
      }),
    );
    const [first] = await createOpenMeteoClient('https://wx.test', fetchFn).getDailyForecast(
      51.53,
      -0.47,
    );

    expect(first).toMatchObject({ et0Mm: 3.1, windSpeedMeanMs: 3, soilTempMeanC: 12 });
    expect(first!.hours).toEqual([
      { time: '2026-06-01T00:00', tempC: 9, humidityPct: 90, windSpeedMs: 2, precipitationMm: 0 },
      {
        time: '2026-06-01T01:00',
        tempC: 8.5,
        humidityPct: 92,
        windSpeedMs: 4,
        precipitationMm: 0.2,
      },
    ]);

    const url = new URL(fetchFn.mock.calls[0]![0] as string);
    expect(url.searchParams.get('hourly')).toBe(
      'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,soil_temperature_6cm',
    );
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('timezone')).toBe('Europe/London');
  });

  it('fetches past weather from the archive API for a date range (FR-3.0)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        daily: {
          time: ['2026-05-01'],
          temperature_2m_mean: [11],
          temperature_2m_max: [15],
          temperature_2m_min: [6],
          relative_humidity_2m_mean: [78],
          precipitation_sum: [4.2],
          et0_fao_evapotranspiration: [2.5],
        },
      }),
    );
    const client = createOpenMeteoClient('https://wx.test', fetchFn, 'https://archive.test');
    const days = await client.getHistory(51.53, -0.47, { start: '2026-05-01', end: '2026-05-31' });

    expect(days).toEqual([
      {
        date: '2026-05-01',
        tempMeanC: 11,
        tempMaxC: 15,
        tempMinC: 6,
        humidityMeanPct: 78,
        precipitationMm: 4.2,
        et0Mm: 2.5,
      },
    ]);
    const url = new URL(fetchFn.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://archive.test/v1/archive');
    expect(url.searchParams.get('start_date')).toBe('2026-05-01');
    expect(url.searchParams.get('end_date')).toBe('2026-05-31');
  });

  it('throws when the archive API fails', async () => {
    const failed = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(
      createOpenMeteoClient('https://wx.test', failed, 'https://archive.test').getHistory(1, 2, {
        start: '2026-05-01',
        end: '2026-05-02',
      }),
    ).rejects.toThrow('500');
  });

  it('throws on a failed response or missing daily data', async () => {
    const failed = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(
      createOpenMeteoClient('https://wx.test', failed).getDailyForecast(1, 2),
    ).rejects.toThrow('503');

    const empty = vi.fn().mockResolvedValue(jsonResponse({}));
    await expect(
      createOpenMeteoClient('https://wx.test', empty).getDailyForecast(1, 2),
    ).rejects.toThrow('daily');
  });
});

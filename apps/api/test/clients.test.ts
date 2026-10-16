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

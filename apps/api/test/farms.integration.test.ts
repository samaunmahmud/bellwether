import { describe, expect, it } from 'vitest';
import type { Location } from '../src/clients/postcodesClient';
import type { WeatherClient } from '../src/clients/weatherClient';
import { buildTestApp, fakeDays, fakePostcodes, fakeWeather, UXBRIDGE } from './fakes';

const WESTMINSTER: Location = {
  postcode: 'SW1A 1AA',
  latitude: 51.501,
  longitude: -0.1416,
  region: 'London',
};

const CREATE_FARM = /* GraphQL */ `
  mutation ($input: CreateFarmInput!) {
    createFarm(input: $input) {
      id
      name
      postcode
    }
  }
`;

const CREATE_FIELD = /* GraphQL */ `
  mutation ($input: CreateFieldInput!) {
    createField(input: $input) {
      id
      name
      postcode
      latitude
      longitude
    }
  }
`;

const CREATE_GROUP = /* GraphQL */ `
  mutation ($input: CreateLivestockGroupInput!) {
    createLivestockGroup(input: $input) {
      id
      name
      species
      livestockClass
      headCount
      housed
      cattleType
      lambingStart
      lambingEnd
      currentField {
        name
      }
    }
  }
`;

const MOVE = /* GraphQL */ `
  mutation ($input: MoveLivestockGroupInput!) {
    moveLivestockGroup(input: $input) {
      movedOn
      fromField {
        name
      }
      toField {
        name
      }
    }
  }
`;

const GROUP_FORECAST = /* GraphQL */ `
  query ($id: ID!) {
    farm(id: $id) {
      groups {
        name
        forecast {
          location {
            source
            latitude
            longitude
            postcode
          }
          risks {
            riskId
            days {
              level
              reason
            }
          }
        }
      }
    }
  }
`;

type Errors = Array<{ extensions?: { code?: string } }> | undefined;

async function setupFarm() {
  const postcodes = fakePostcodes([UXBRIDGE, WESTMINSTER]);
  const t = buildTestApp({ postcodes: postcodes.client });
  const gql = await t.signedIn();
  const farm = await gql<{ createFarm: { id: string; postcode: string } }>(CREATE_FARM, {
    input: { name: 'Hill Farm', postcode: 'ub8 3ph' },
  });
  return { ...t, gql, farmId: farm.data!.createFarm.id };
}

describe('farms, fields and livestock groups', () => {
  it('creates a farm with a normalised postcode (FR-2.1)', async () => {
    const gql = await buildTestApp().signedIn();
    const res = await gql(CREATE_FARM, { input: { name: ' Hill Farm ', postcode: 'ub83ph' } });
    expect(res.errors).toBeUndefined();
    expect(res.data).toEqual({
      createFarm: { id: expect.any(String), name: 'Hill Farm', postcode: 'UB8 3PH' },
    });
  });

  it('gets its forecast from the field pin, not the farm postcode (FR-2.2 acceptance)', async () => {
    const { gql, weather, farmId } = await setupFarm();
    const field = await gql<{ createField: { id: string } }>(CREATE_FIELD, {
      input: { farmId, name: 'Fell', latitude: 54.1234, longitude: -2.5432 },
    });
    await gql(CREATE_GROUP, {
      input: {
        farmId,
        name: 'Fell flock',
        species: 'SHEEP',
        livestockClass: 'EWES',
        headCount: 200,
        currentFieldId: field.data!.createField.id,
      },
    });

    const res = await gql<{
      farm: {
        groups: Array<{
          forecast: {
            location: Record<string, unknown>;
            risks: Array<{ riskId: string; days: unknown[] }>;
          };
        }>;
      };
    }>(GROUP_FORECAST, { id: farmId });

    expect(res.errors).toBeUndefined();
    const forecast = res.data!.farm.groups[0]!.forecast;
    expect(forecast.location).toEqual({
      source: 'PIN',
      latitude: 54.1234,
      longitude: -2.5432,
      postcode: null,
    });
    expect(weather.calls).toEqual([[54.12, -2.54]]);
    expect(weather.calls).not.toContainEqual([51.53, -0.47]); // farm postcode
    // Only the risks that apply to the group's species
    expect(forecast.risks.map((r) => r.riskId)).toEqual(['sheep-blowfly']);
    expect(forecast.risks[0]!.days).toHaveLength(14);
  });

  it('uses the field postcode, then the farm postcode, when there is no pin', async () => {
    const { gql, weather, farmId } = await setupFarm();
    const field = await gql<{ createField: { id: string } }>(CREATE_FIELD, {
      input: { farmId, name: 'Meadow', postcode: 'SW1A 1AA' },
    });
    await gql(CREATE_GROUP, {
      input: {
        farmId,
        name: 'A herd',
        species: 'CATTLE',
        livestockClass: 'BEEF_CATTLE',
        headCount: 40,
        currentFieldId: field.data!.createField.id,
      },
    });
    await gql(CREATE_GROUP, {
      input: {
        farmId,
        name: 'B herd',
        species: 'CATTLE',
        livestockClass: 'DAIRY_COWS',
        headCount: 90,
        housed: true,
      },
    });

    const res = await gql<{
      farm: {
        groups: Array<{
          name: string;
          forecast: { location: { source: string }; risks: Array<{ riskId: string }> };
        }>;
      };
    }>(GROUP_FORECAST, { id: farmId });

    expect(res.errors).toBeUndefined();
    const [a, b] = res.data!.farm.groups;
    expect(a!.forecast.location.source).toBe('FIELD_POSTCODE');
    expect(b!.forecast.location.source).toBe('FARM_POSTCODE');
    expect(a!.forecast.risks.map((r) => r.riskId)).toEqual(['cattle-heat-stress']);
    // Groups resolve in parallel, so the call order isn't fixed.
    expect(weather.calls).toHaveLength(2);
    expect(weather.calls).toEqual(
      expect.arrayContaining([
        [51.5, -0.14],
        [51.53, -0.47],
      ]),
    );
  });

  it('creates groups with species attributes (FR-2.3, FR-2.5)', async () => {
    const { gql, farmId } = await setupFarm();
    const res = await gql(CREATE_GROUP, {
      input: {
        farmId,
        name: 'Ewes',
        species: 'SHEEP',
        livestockClass: 'EWES',
        headCount: 150,
        lambingStart: '2026-03-01',
        lambingEnd: '2026-04-10',
        lambsAtGrassThisSpring: true,
      },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data).toEqual({
      createLivestockGroup: {
        id: expect.any(String),
        name: 'Ewes',
        species: 'SHEEP',
        livestockClass: 'EWES',
        headCount: 150,
        housed: false,
        cattleType: null,
        lambingStart: '2026-03-01',
        lambingEnd: '2026-04-10',
        currentField: null,
      },
    });
  });

  it('records moves between fields and keeps the history (FR-2.4)', async () => {
    const { gql, farmId } = await setupFarm();
    const top = await gql<{ createField: { id: string } }>(CREATE_FIELD, {
      input: { farmId, name: 'Top' },
    });
    const lower = await gql<{ createField: { id: string } }>(CREATE_FIELD, {
      input: { farmId, name: 'Lower' },
    });
    const group = await gql<{ createLivestockGroup: { id: string } }>(CREATE_GROUP, {
      input: {
        farmId,
        name: 'Flock',
        species: 'SHEEP',
        livestockClass: 'EWES',
        headCount: 50,
        currentFieldId: top.data!.createField.id,
      },
    });
    const groupId = group.data!.createLivestockGroup.id;

    const move = await gql(MOVE, {
      input: { groupId, toFieldId: lower.data!.createField.id, movedOn: '2026-06-01' },
    });
    expect(move.errors).toBeUndefined();
    expect(move.data).toEqual({
      moveLivestockGroup: {
        movedOn: '2026-06-01',
        fromField: { name: 'Top' },
        toField: { name: 'Lower' },
      },
    });

    const history = await gql<{
      farm: {
        groups: Array<{
          currentField: { name: string };
          movements: Array<{ fromField: { name: string } | null; toField: { name: string } }>;
        }>;
      };
    }>(
      /* GraphQL */ `
        query ($id: ID!) {
          farm(id: $id) {
            groups {
              currentField {
                name
              }
              movements {
                fromField {
                  name
                }
                toField {
                  name
                }
              }
            }
          }
        }
      `,
      { id: farmId },
    );
    const g = history.data!.farm.groups[0]!;
    expect(g.currentField.name).toBe('Lower');
    expect(g.movements).toEqual([
      { fromField: { name: 'Top' }, toField: { name: 'Lower' } },
      { fromField: null, toField: { name: 'Top' } },
    ]);
  });

  it('updates a group', async () => {
    const { gql, farmId } = await setupFarm();
    const group = await gql<{ createLivestockGroup: { id: string } }>(CREATE_GROUP, {
      input: { farmId, name: 'Flock', species: 'SHEEP', livestockClass: 'EWES', headCount: 50 },
    });
    const res = await gql(
      /* GraphQL */ `
        mutation ($id: ID!, $input: UpdateLivestockGroupInput!) {
          updateLivestockGroup(id: $id, input: $input) {
            headCount
            housed
            lastShearingDate
          }
        }
      `,
      {
        id: group.data!.createLivestockGroup.id,
        input: { headCount: 48, housed: true, lastShearingDate: '2026-05-30' },
      },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data).toEqual({
      updateLivestockGroup: { headCount: 48, housed: true, lastShearingDate: '2026-05-30' },
    });
  });

  it('lists farms with their fields, and returns null for an unknown farm', async () => {
    const { gql, farmId } = await setupFarm();
    await gql(CREATE_FIELD, { input: { farmId, name: 'Top' } });
    const res = await gql(`query { farms { name fields { name } } }`);
    expect(res.data).toEqual({ farms: [{ name: 'Hill Farm', fields: [{ name: 'Top' }] }] });

    const missing = await gql(`query { farm(id: "nope") { name } }`);
    expect(missing.data).toEqual({ farm: null });
  });

  it('returns clear error codes for bad input', async () => {
    const { gql, farmId } = await setupFarm();
    const cases: Array<[string, Record<string, unknown>, string]> = [
      [CREATE_FARM, { input: { name: 'X', postcode: 'nope' } }, 'INVALID_POSTCODE'],
      [CREATE_FIELD, { input: { farmId, name: 'Hill', latitude: 54 } }, 'BAD_INPUT'],
      [
        CREATE_GROUP,
        {
          input: { farmId, name: 'X', species: 'SHEEP', livestockClass: 'CALVES', headCount: 5 },
        },
        'BAD_INPUT',
      ],
      [MOVE, { input: { groupId: 'nope', toFieldId: 'nope', movedOn: '2026-06-01' } }, 'NOT_FOUND'],
    ];
    for (const [query, variables, expected] of cases) {
      const res = await gql(query, variables);
      expect((res.errors as Errors)?.[0]?.extensions?.code).toBe(expected);
    }
  });
});

describe('group forecasts use the group’s details (FR-3.0 to FR-3.4)', () => {
  const GROUP_RISKS = /* GraphQL */ `
    query ($id: ID!) {
      farm(id: $id) {
        groups {
          name
          forecast {
            risks {
              riskId
              days {
                date
                level
                reason
              }
            }
          }
        }
      }
    }
  `;

  type GroupRisks = {
    farm: {
      groups: Array<{
        name: string;
        forecast: {
          risks: Array<{ riskId: string; days: Array<{ level: string; reason: string }> }>;
        };
      }>;
    };
  };

  /** Every day of a month, wet enough to max out that month's fluke value. */
  function wetMonth(yearMonth: string) {
    const [y, m] = yearMonth.split('-').map(Number);
    const length = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    return Array.from({ length }, (_, i) => ({
      ...fakeDays(1)[0]!,
      date: `${yearMonth}-${String(i + 1).padStart(2, '0')}`,
      precipitationMm: i < 20 ? 6 : 0,
      et0Mm: 1,
    }));
  }

  async function setUp(
    groupInput: Record<string, unknown>,
    options: { weather?: WeatherClient; now?: Date } = {},
  ) {
    const t = buildTestApp({
      ...(options.weather ? { weather: options.weather } : {}),
      ...(options.now ? { now: () => options.now! } : {}),
    });
    const gql = await t.signedIn();
    const farm = await gql<{ createFarm: { id: string } }>(CREATE_FARM, {
      input: { name: 'Hill Farm', postcode: 'UB8 3PH' },
    });
    const farmId = farm.data!.createFarm.id;
    const created = await gql(CREATE_GROUP, {
      input: { farmId, name: 'Group', headCount: 10, ...groupInput },
    });
    expect(created.errors).toBeUndefined();
    const res = await gql<GroupRisks>(GROUP_RISKS, { id: farmId });
    expect(res.errors).toBeUndefined();
    return { risks: res.data!.farm.groups[0]!.forecast.risks, t };
  }

  const sheep = { species: 'SHEEP', livestockClass: 'EWES' };
  const ids = (risks: Array<{ riskId: string }>) => risks.map((r) => r.riskId);

  it('adds lamb chill only for sheep lambing during the forecast (FR-3.2)', async () => {
    const lambing = await setUp({ ...sheep, lambingStart: '2026-05-20', lambingEnd: '2026-06-05' });
    expect(ids(lambing.risks)).toContain('lamb-chill');

    const notLambing = await setUp(sheep);
    expect(ids(notLambing.risks)).not.toContain('lamb-chill');
  });

  it('raises blowfly risk for a flock with no shearing date (FR-3.4)', async () => {
    const { risks } = await setUp(sheep);
    const blowfly = risks.find((r) => r.riskId === 'sheep-blowfly')!;
    expect(blowfly.days[0]!.reason).toMatch(/no shearing date is recorded/);
  });

  it('notes that housed cattle may see different conditions (FR-3.1)', async () => {
    const { risks } = await setUp({
      species: 'CATTLE',
      livestockClass: 'BEEF_CATTLE',
      housed: true,
    });
    const heat = risks.find((r) => r.riskId === 'cattle-heat-stress')!;
    expect(heat.days[0]!.reason).toMatch(/housed/);
  });

  it('asks for past weather up to the last full week the archive has (FR-3.3)', async () => {
    const weather = fakeWeather();
    const { t } = await setUp(sheep, { weather: weather.client });
    // Forecast starts 1 June 2026: season May; archive is ~5 days behind (27 May),
    // rounded down to Sunday 24 May so the season result changes weekly.
    expect(weather.historyCalls).toEqual([
      { lat: 51.53, lon: -0.47, start: '2026-05-01', end: '2026-05-24' },
    ]);
    expect(t).toBeDefined();
  });

  it('includes liver fluke when a season’s weather is available (FR-3.3)', async () => {
    const january = fakeDays(14).map((d, i) => ({
      ...d,
      date: `2026-01-${String(i + 10).padStart(2, '0')}`,
    }));
    const season2025 = ['05', '06', '07', '08', '09', '10'].flatMap((m) => wetMonth(`2025-${m}`));
    const weather = fakeWeather(january, season2025);

    const { risks } = await setUp(
      { species: 'CATTLE', livestockClass: 'BEEF_CATTLE' },
      { weather: weather.client, now: new Date('2026-01-10T07:00:00Z') },
    );
    const fluke = risks.find((r) => r.riskId === 'liver-fluke')!;
    expect(fluke.days[0]!.level).toBe('HIGH');
    expect(fluke.days[0]!.reason).toMatch(/from May–Oct 2025 weather/);
    expect(weather.historyCalls[0]).toMatchObject({ start: '2025-05-01', end: '2025-10-31' });
  });

  it('still forecasts the other risks if past weather is unavailable', async () => {
    const weather = fakeWeather();
    const failing: WeatherClient = {
      getDailyForecast: weather.client.getDailyForecast,
      getHistory: async () => {
        throw new Error('archive down');
      },
    };
    const { risks } = await setUp(sheep, { weather: failing });
    expect(ids(risks)).toEqual(['sheep-blowfly']);
  });
});

describe('managing a farm', () => {
  it('edits the farm and a field, and archives and restores a field', async () => {
    const { gql, farmId } = await setupFarm();
    const farm = await gql<{ updateFarm: unknown }>(
      `mutation ($id: ID!) { updateFarm(id: $id, input: { name: "High Farm", postcode: "sw1a 1aa" }) { name postcode } }`,
      { id: farmId },
    );
    expect(farm.data!.updateFarm).toEqual({ name: 'High Farm', postcode: 'SW1A 1AA' });

    const field = await gql<{ createField: { id: string } }>(CREATE_FIELD, {
      input: { farmId, name: 'Top' },
    });
    const id = field.data!.createField.id;
    const renamed = await gql<{ updateField: unknown }>(
      `mutation ($id: ID!) { updateField(id: $id, input: { name: "Top meadow", latitude: 54.1, longitude: -2.5 }) { name latitude longitude } }`,
      { id },
    );
    expect(renamed.data!.updateField).toEqual({
      name: 'Top meadow',
      latitude: 54.1,
      longitude: -2.5,
    });

    await gql(`mutation ($id: ID!) { setFieldArchived(id: $id, archived: true) { id } }`, { id });
    const lists = await gql<{ farm: { fields: unknown[]; archivedFields: unknown[] } }>(
      `query ($id: ID!) { farm(id: $id) { fields { id } archivedFields { id archived archivedOn } } }`,
      { id: farmId },
    );
    expect(lists.data!.farm.fields).toEqual([]);
    expect(lists.data!.farm.archivedFields).toEqual([
      { id, archived: true, archivedOn: '2026-06-01' },
    ]);
  });

  it('archives a sold group out of the farm and its briefing, keeping it reachable', async () => {
    const { gql, farmId } = await setupFarm();
    const group = await gql<{ createLivestockGroup: { id: string } }>(CREATE_GROUP, {
      input: {
        farmId,
        name: 'Store lambs',
        species: 'SHEEP',
        livestockClass: 'LAMBS',
        headCount: 40,
      },
    });
    const id = group.data!.createLivestockGroup.id;
    const archived = await gql<{ archiveLivestockGroup: unknown }>(
      `mutation ($id: ID!) {
        archiveLivestockGroup(id: $id, input: { archivedOn: "2026-05-30", reason: "Sold" }) {
          archivedOn archiveReason
        }
      }`,
      { id },
    );
    expect(archived.data!.archiveLivestockGroup).toEqual({
      archivedOn: '2026-05-30',
      archiveReason: 'Sold',
    });

    const farm = await gql<{
      farm: { groups: unknown[]; archivedGroups: Array<{ id: string }> };
      briefing: { quietGroups: unknown[]; groups: unknown[] };
    }>(
      `query ($id: ID!) {
        farm(id: $id) { groups { id } archivedGroups { id } }
        briefing(farmId: $id) { quietGroups { groupId } groups { groupId } }
      }`,
      { id: farmId },
    );
    expect(farm.data!.farm.groups).toEqual([]);
    expect(farm.data!.farm.archivedGroups).toEqual([{ id }]);
    expect(farm.data!.briefing).toEqual({ quietGroups: [], groups: [] });

    const restored = await gql<{ restoreLivestockGroup: { archivedOn: null } }>(
      `mutation ($id: ID!) { restoreLivestockGroup(id: $id) { archivedOn } }`,
      { id },
    );
    expect(restored.data!.restoreLivestockGroup.archivedOn).toBeNull();
  });

  it('deletes a farm once its name is typed', async () => {
    const { gql, farmId } = await setupFarm();
    const wrong = await gql(`mutation ($id: ID!) { deleteFarm(id: $id, confirmName: "Hill") }`, {
      id: farmId,
    });
    expect(wrong.errors?.[0]?.extensions?.code).toBe('BAD_INPUT');
    const ok = await gql<{ deleteFarm: boolean }>(
      `mutation ($id: ID!) { deleteFarm(id: $id, confirmName: "hill farm") }`,
      { id: farmId },
    );
    expect(ok.data!.deleteFarm).toBe(true);
    expect((await gql<{ farms: unknown[] }>(`query { farms { id } }`)).data!.farms).toEqual([]);
  });
});

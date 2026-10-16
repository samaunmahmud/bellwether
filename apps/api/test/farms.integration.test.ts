import { describe, expect, it } from 'vitest';
import type { Location } from '../src/clients/postcodesClient';
import { buildTestApp, fakePostcodes, UXBRIDGE } from './fakes';

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

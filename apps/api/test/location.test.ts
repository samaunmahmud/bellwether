import { describe, expect, it } from 'vitest';
import { resolveLocationRef, type Farm, type Field } from '../src/domain/farm';

const farm: Farm = { id: 'f1', name: 'Hill Farm', postcode: 'UB8 3PH' };
const field = (overrides: Partial<Field> = {}): Field => ({
  id: 'fd1',
  farmId: 'f1',
  name: 'Top field',
  postcode: null,
  latitude: null,
  longitude: null,
  archivedOn: null,
  ...overrides,
});

describe('resolveLocationRef (FR-2.2)', () => {
  it('uses the field pin when it has one, even if it also has a postcode', () => {
    expect(
      resolveLocationRef(
        farm,
        field({ postcode: 'SW1A 1AA', latitude: 54.1, longitude: -2.5 }),
        false,
      ),
    ).toEqual({ source: 'PIN', latitude: 54.1, longitude: -2.5 });
  });

  it('uses the field postcode when there is no pin', () => {
    expect(resolveLocationRef(farm, field({ postcode: 'SW1A 1AA' }), false)).toEqual({
      source: 'FIELD_POSTCODE',
      postcode: 'SW1A 1AA',
    });
  });

  it('falls back to the farm postcode when the field has neither', () => {
    expect(resolveLocationRef(farm, field(), false)).toEqual({
      source: 'FARM_POSTCODE',
      postcode: 'UB8 3PH',
    });
  });

  it('falls back to the farm postcode when the group has no field', () => {
    expect(resolveLocationRef(farm, null, false)).toEqual({
      source: 'FARM_POSTCODE',
      postcode: 'UB8 3PH',
    });
  });

  it('uses the farm postcode for a housed group, even if its field has a pin', () => {
    // Assumption A1: sheds are at the farmstead, so housed groups get the farm's weather.
    expect(
      resolveLocationRef(
        farm,
        field({ postcode: 'SW1A 1AA', latitude: 54.1, longitude: -2.5 }),
        true,
      ),
    ).toEqual({ source: 'FARM_POSTCODE', postcode: 'UB8 3PH' });
  });
});

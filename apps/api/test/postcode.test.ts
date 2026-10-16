import { describe, expect, it } from 'vitest';
import { normalisePostcode } from '../src/postcode';

describe('normalisePostcode', () => {
  it.each([
    ['ub8 3ph', 'UB8 3PH'],
    ['UB83PH', 'UB8 3PH'],
    ['  sw1a   1aa ', 'SW1A 1AA'],
    ['M1 1AE', 'M1 1AE'],
    ['EC1A1BB', 'EC1A 1BB'],
  ])('%s → %s', (input, expected) => {
    expect(normalisePostcode(input)).toBe(expected);
  });

  it.each(['', 'hello', '12345', 'UB8', 'UB8 3P', 'UB8 33H'])('rejects %j', (input) => {
    expect(normalisePostcode(input)).toBeNull();
  });
});

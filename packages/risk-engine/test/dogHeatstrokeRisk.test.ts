import { describe, expect, it } from 'vitest';
import { dogHeatstrokeRisk } from '../src/risks/dogHeatstrokeRisk';
import { day } from './helpers';

const levelAt = (tempMaxC: number) => dogHeatstrokeRisk.assess([day({ tempMaxC })])[0]!.level;

describe('dogHeatstrokeRisk', () => {
  it.each([
    [19.9, 'LOW'],
    [20, 'MEDIUM'],
    [25, 'MEDIUM'],
    [25.1, 'HIGH'],
  ])('max %s°C → %s', (temp, expected) => {
    expect(levelAt(temp)).toBe(expected);
  });

  it('suggests cooler hours without giving medical instructions', () => {
    const result = dogHeatstrokeRisk.assess([day({ tempMaxC: 30 })])[0]!;
    expect(result.reason).toMatch(/early morning or evening/i);
    expect(result.reason).not.toMatch(/dose|medicine|drug/i);
  });

  it('applies only to dogs', () => {
    expect(dogHeatstrokeRisk.animals).toEqual(['dog']);
  });
});

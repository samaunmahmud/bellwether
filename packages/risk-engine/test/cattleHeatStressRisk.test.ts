import { describe, expect, it } from 'vitest';
import { calculateTHI, cattleHeatStressRisk } from '../src/risks/cattleHeatStressRisk';
import { day } from './helpers';

describe('calculateTHI', () => {
  // Hand-worked: THI = (1.8T + 32) - (0.55 - 0.0055RH)(1.8T - 26)
  it.each([
    // T=20, RH=50: 68 - (0.275)(10) = 65.25
    [20, 50, 65.25],
    // T=25, RH=60: 77 - (0.22)(19) = 72.82
    [25, 60, 72.82],
    // T=30, RH=80: 86 - (0.11)(28) = 82.92
    [30, 80, 82.92],
    // RH=100 removes the correction term entirely: THI = 1.8T + 32
    [10, 100, 50],
  ])('T=%s°C, RH=%s%% → %s', (t, rh, expected) => {
    expect(calculateTHI(t, rh)).toBeCloseTo(expected, 2);
  });
});

describe('cattleHeatStressRisk', () => {
  it('is LOW below THI 68', () => {
    const result = cattleHeatStressRisk.assess([day({ tempMaxC: 20, humidityMeanPct: 50 })])[0]!;
    expect(result.level).toBe('LOW');
    expect(result.reason).toContain('THI 65.3');
  });

  it('is MEDIUM between 68 and 72', () => {
    // T=22, RH=60: 71.6 - (0.22)(13.6) = 68.608
    const result = cattleHeatStressRisk.assess([day({ tempMaxC: 22, humidityMeanPct: 60 })])[0]!;
    expect(result.level).toBe('MEDIUM');
  });

  it('is HIGH at THI 72 or above and shows the value', () => {
    const result = cattleHeatStressRisk.assess([day({ tempMaxC: 25, humidityMeanPct: 60 })])[0]!;
    expect(result.level).toBe('HIGH');
    expect(result.reason).toBe('THI 72.8: heat stress likely');
  });

  it('uses the boundary exactly: THI 68 is MEDIUM, THI 72 is HIGH', () => {
    // RH=100 means THI = 1.8T + 32, so we can hit exact values.
    const at68 = cattleHeatStressRisk.assess([day({ tempMaxC: 20, humidityMeanPct: 100 })])[0]!;
    const at72 = cattleHeatStressRisk.assess([
      day({ tempMaxC: 40 / 1.8, humidityMeanPct: 100 }),
    ])[0]!;
    expect(at68.level).toBe('MEDIUM');
    expect(at72.level).toBe('HIGH');
  });

  it('clamps the chart score to 0–100', () => {
    const [cold, hot] = cattleHeatStressRisk.assess([
      day({ tempMaxC: -10, humidityMeanPct: 50 }),
      day({ tempMaxC: 45, humidityMeanPct: 90 }),
    ]);
    expect(cold!.score).toBe(0);
    expect(hot!.score).toBe(100);
  });
});

import { describe, expect, it } from 'vitest';
import { historyRangeFor, modulesForGroup } from '../src/registry';
import type { RiskModule } from '../src/types';
import { day } from './helpers';

const ids = (modules: RiskModule[]) => modules.map((m) => m.id);

describe('modulesForGroup (FR-3.0)', () => {
  it('picks the farm modules for the group’s species', () => {
    expect(ids(modulesForGroup({ group: { species: 'cattle' } }, [day()]))).toContain(
      'cattle-heat-stress',
    );
    expect(ids(modulesForGroup({ group: { species: 'cattle' } }, [day()]))).not.toContain(
      'sheep-blowfly',
    );
    expect(ids(modulesForGroup({ group: { species: 'sheep' } }, [day()]))).toContain(
      'sheep-blowfly',
    );
  });

  it('never includes pet modules', () => {
    const all = [
      ...modulesForGroup({ group: { species: 'cattle' } }, [day()]),
      ...modulesForGroup({ group: { species: 'sheep' } }, [day()]),
    ];
    expect(all.every((m) => m.category === 'farm')).toBe(true);
  });
});

describe('historyRangeFor (FR-3.0)', () => {
  it('is null when no chosen module needs past weather', () => {
    const noHistory: RiskModule = {
      id: 'x',
      name: 'X',
      category: 'farm',
      animals: ['sheep'],
      assess: () => [],
    };
    expect(historyRangeFor([noHistory], '2026-06-01')).toBeNull();
  });

  it('covers every range the modules ask for', () => {
    const make = (start: string, end: string): RiskModule => ({
      id: start,
      name: start,
      category: 'farm',
      animals: ['sheep'],
      assess: () => [],
      historyRange: () => ({ start, end }),
    });
    expect(
      historyRangeFor([make('2026-05-01', '2026-05-31'), make('2026-04-01', '2026-05-10')], 'x'),
    ).toEqual({ start: '2026-04-01', end: '2026-05-31' });
  });
});

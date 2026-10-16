import type { GroupContext } from '@bellwether/risk-engine';
import type { LivestockGroup } from './farm';

/** The risk engine's view of a livestock group (FR-3.0). */
export function toGroupContext(group: LivestockGroup): GroupContext {
  return {
    species: group.species === 'SHEEP' ? 'sheep' : 'cattle',
    livestockClass: group.livestockClass,
    housed: group.housed,
    lastShearingDate: group.lastShearingDate,
    lambingStart: group.lambingStart,
    lambingEnd: group.lambingEnd,
    lambsAtGrassThisSpring: group.lambsAtGrassThisSpring,
  };
}

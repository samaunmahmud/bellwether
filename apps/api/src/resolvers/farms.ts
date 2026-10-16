import type { Farm, GroupMovement, LivestockGroup } from '../domain/farm';
import type {
  FarmService,
  FieldInput,
  GroupInput,
  GroupUpdate,
  MoveInput,
} from '../services/farmService';
import type { ForecastService } from '../services/forecastService';

export interface FarmResolverDeps {
  farmService: FarmService;
  forecastService: ForecastService;
}

/** Resolvers for farms, fields, livestock groups and movements (FR-2). */
export function createFarmResolvers({ farmService, forecastService }: FarmResolverDeps) {
  return {
    Query: {
      farms: () => farmService.listFarms(),
      farm: (_: unknown, args: { id: string }) => farmService.getFarm(args.id),
    },

    Mutation: {
      createFarm: (_: unknown, args: { input: { name: string; postcode: string } }) =>
        farmService.createFarm(args.input),
      createField: (_: unknown, args: { input: FieldInput }) => farmService.createField(args.input),
      createLivestockGroup: (_: unknown, args: { input: GroupInput }) =>
        farmService.createGroup(args.input),
      updateLivestockGroup: (_: unknown, args: { id: string; input: GroupUpdate }) =>
        farmService.updateGroup(args.id, args.input),
      moveLivestockGroup: (_: unknown, args: { input: MoveInput }) =>
        farmService.moveGroup(args.input),
    },

    Farm: {
      fields: (farm: Farm) => farmService.listFields(farm.id),
      groups: (farm: Farm) => farmService.listGroups(farm.id),
    },

    LivestockGroup: {
      currentField: (group: LivestockGroup) =>
        group.currentFieldId ? farmService.getField(group.currentFieldId) : null,
      movements: (group: LivestockGroup) => farmService.listMovements(group.id),
      forecast: async (group: LivestockGroup) => {
        const location = await farmService.locateGroup(group);
        const forecast = await forecastService.getSpeciesForecastAt(
          location.latitude,
          location.longitude,
          group.species,
        );
        return { location, ...forecast };
      },
    },

    GroupMovement: {
      fromField: (m: GroupMovement) => (m.fromFieldId ? farmService.getField(m.fromFieldId) : null),
      toField: (m: GroupMovement) => farmService.getField(m.toFieldId),
    },
  };
}

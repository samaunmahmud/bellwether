import { requireUser, type GraphQLContext } from '../auth/context';
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

/**
 * Resolvers for farms, fields, livestock groups and movements (FR-2).
 * Top-level operations are scoped to the signed-in user's farms (FR-8.4); nested fields
 * only run on records that have already passed that check.
 */
export function createFarmResolvers({ farmService, forecastService }: FarmResolverDeps) {
  return {
    Query: {
      farms: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        farmService.listFarms(requireUser(ctx).id),
      farm: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        farmService.getFarm(requireUser(ctx).id, args.id),
    },

    Mutation: {
      createFarm: (
        _: unknown,
        args: { input: { name: string; postcode: string } },
        ctx: GraphQLContext,
      ) => farmService.createFarm(requireUser(ctx).id, args.input),
      createField: (_: unknown, args: { input: FieldInput }, ctx: GraphQLContext) =>
        farmService.createField(requireUser(ctx).id, args.input),
      createLivestockGroup: (_: unknown, args: { input: GroupInput }, ctx: GraphQLContext) =>
        farmService.createGroup(requireUser(ctx).id, args.input),
      updateLivestockGroup: (
        _: unknown,
        args: { id: string; input: GroupUpdate },
        ctx: GraphQLContext,
      ) => farmService.updateGroup(requireUser(ctx).id, args.id, args.input),
      moveLivestockGroup: (_: unknown, args: { input: MoveInput }, ctx: GraphQLContext) =>
        farmService.moveGroup(requireUser(ctx).id, args.input),
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

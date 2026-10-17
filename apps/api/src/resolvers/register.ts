import { requireUser, type GraphQLContext } from '../auth/context';
import type { Farm, Field, LivestockGroup } from '../domain/farm';
import type { MedicineItem, RegisterEvent } from '../domain/register';
import type { DemoFarmService } from '../services/demoFarmService';
import type { FarmService } from '../services/farmService';
import type { InsightsService } from '../services/insightsService';
import type {
  MedicineInput,
  RegisterEventInput,
  RegisterService,
} from '../services/registerService';

export interface RegisterResolverDeps {
  farmService: FarmService;
  registerService: RegisterService;
  insightsService: InsightsService;
  demoFarmService: DemoFarmService;
}

/** v3: holding register, medicine cabinet, dashboard insights and the demo farm. */
export function createRegisterResolvers(deps: RegisterResolverDeps) {
  const { farmService, registerService, insightsService } = deps;
  return {
    Query: {
      holdingRegister: (_: unknown, args: { farmId: string }, ctx: GraphQLContext) =>
        registerService.holdingRegister(requireUser(ctx).id, args.farmId),
      registerEvents: (_: unknown, args: { farmId: string }, ctx: GraphQLContext) =>
        registerService.events(requireUser(ctx).id, args.farmId),
      medicines: (_: unknown, args: { farmId: string }, ctx: GraphQLContext) =>
        registerService.medicines(requireUser(ctx).id, args.farmId),
    },

    Mutation: {
      recordRegisterEvent: (_: unknown, args: { input: RegisterEventInput }, ctx: GraphQLContext) =>
        registerService.record(requireUser(ctx), args.input),
      voidRegisterEvent: (_: unknown, args: { id: string; reason: string }, ctx: GraphQLContext) =>
        registerService.voidEvent(requireUser(ctx), args.id, args.reason),
      addMedicine: (
        _: unknown,
        args: { farmId: string; input: MedicineInput },
        ctx: GraphQLContext,
      ) => registerService.addMedicine(requireUser(ctx).id, args.farmId, args.input),
      updateMedicine: (
        _: unknown,
        args: { id: string; input: MedicineInput },
        ctx: GraphQLContext,
      ) => registerService.updateMedicine(requireUser(ctx).id, args.id, args.input),
      deleteMedicine: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        registerService.deleteMedicine(requireUser(ctx).id, args.id),
      createDemoFarm: (_: unknown, args: { postcode: string }, ctx: GraphQLContext) =>
        deps.demoFarmService.create(requireUser(ctx), args.postcode),
    },

    // Nested fields only run on a farm, field or group the user has already been allowed to see.
    Farm: {
      location: (farm: Farm) => insightsService.location(farm),
      weather: (farm: Farm) => insightsService.weather(farm),
      stats: (farm: Farm) => insightsService.stats(farm),
      alerts: (farm: Farm) => insightsService.alerts(farm),
      activity: (farm: Farm, args: { limit?: number | null }) =>
        insightsService.activity(farm, Math.min(Math.max(args.limit ?? 20, 1), 200)),
    },

    Field: {
      grazing: (field: Field) => insightsService.grazing(field),
    },

    LivestockGroup: {
      registerEvents: (group: LivestockGroup) =>
        registerService.eventsForGroup(group.id, group.farmId),
      weights: (group: LivestockGroup) => registerService.weights(group),
    },

    RegisterEvent: {
      voided: (e: RegisterEvent) => e.voidedAt !== null,
      group: (e: RegisterEvent, _: unknown, ctx: GraphQLContext) =>
        farmService.getGroup(requireUser(ctx).id, e.groupId),
    },

    MedicineItem: {
      status: (item: MedicineItem) => registerService.medicineStatus(item),
    },
  };
}

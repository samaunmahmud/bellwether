import { requireUser, type GraphQLContext } from '../auth/context';
import type { LivestockGroup } from '../domain/farm';
import { withdrawalEnds, type Treatment } from '../domain/records';
import type { FarmService } from '../services/farmService';
import type { ObservationInput, RecordsService, TreatmentInput } from '../services/recordsService';

export interface RecordsResolverDeps {
  farmService: FarmService;
  recordsService: RecordsService;
}

/** Treatment records, withdrawal status and checks (FR-6), scoped per farm (FR-8.4). */
export function createRecordsResolvers({ farmService, recordsService }: RecordsResolverDeps) {
  return {
    Query: {
      livestockGroup: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        farmService.getGroup(requireUser(ctx).id, args.id),
      treatments: (
        _: unknown,
        args: { farmId: string; from: string; to: string },
        ctx: GraphQLContext,
      ) => recordsService.farmTreatments(requireUser(ctx).id, args.farmId, args.from, args.to),
    },

    Mutation: {
      recordTreatment: (_: unknown, args: { input: TreatmentInput }, ctx: GraphQLContext) =>
        recordsService.recordTreatment(requireUser(ctx).id, args.input),
      recordObservation: (_: unknown, args: { input: ObservationInput }, ctx: GraphQLContext) =>
        recordsService.recordObservation(requireUser(ctx).id, args.input),
    },

    LivestockGroup: {
      farm: (group: LivestockGroup, _: unknown, ctx: GraphQLContext) =>
        farmService.getFarm(requireUser(ctx).id, group.farmId),
      treatments: (group: LivestockGroup) => recordsService.treatmentsFor(group.id),
      observations: (group: LivestockGroup) => recordsService.observationsFor(group.id),
      withdrawal: (group: LivestockGroup) => recordsService.withdrawalFor(group.id),
    },

    Treatment: {
      meatWithdrawalEnds: (t: Treatment) => withdrawalEnds(t.date, t.meatWithdrawalDays),
      milkWithdrawalEnds: (t: Treatment) => withdrawalEnds(t.date, t.milkWithdrawalDays),
      group: (t: Treatment, _: unknown, ctx: GraphQLContext) =>
        farmService.getGroup(requireUser(ctx).id, t.groupId),
    },
  };
}

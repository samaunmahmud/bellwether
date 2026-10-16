import { requireUser, type GraphQLContext } from '../auth/context';
import type { LivestockGroup } from '../domain/farm';
import { withdrawalEnds, type RecordRevision, type Treatment } from '../domain/records';
import type { FarmService } from '../services/farmService';
import type {
  Correction,
  ObservationInput,
  RecordsService,
  TreatmentInput,
} from '../services/recordsService';

type CorrectionArgs<T> = { id: string; input: Correction<T>['input']; reason: string };

/** Fields shared by treatments and observations for voids and history (FR-6.5). */
const recordFields = (recordsService: RecordsService) => ({
  voided: (r: { voidedAt: string | null }) => r.voidedAt !== null,
  history: (r: { id: string }) => recordsService.historyFor(r.id),
});

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
      correctTreatment: (
        _: unknown,
        { id, input, reason }: CorrectionArgs<Omit<TreatmentInput, 'groupId'>>,
        ctx: GraphQLContext,
      ) => recordsService.correctTreatment(requireUser(ctx), id, { input, reason }),
      voidTreatment: (_: unknown, args: { id: string; reason: string }, ctx: GraphQLContext) =>
        recordsService.voidTreatment(requireUser(ctx), args.id, args.reason),
      correctObservation: (
        _: unknown,
        { id, input, reason }: CorrectionArgs<Omit<ObservationInput, 'groupId'>>,
        ctx: GraphQLContext,
      ) => recordsService.correctObservation(requireUser(ctx), id, { input, reason }),
      voidObservation: (_: unknown, args: { id: string; reason: string }, ctx: GraphQLContext) =>
        recordsService.voidObservation(requireUser(ctx), args.id, args.reason),
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
      ...recordFields(recordsService),
    },

    Observation: recordFields(recordsService),

    RecordRevision: {
      by: (r: RecordRevision) => r.editedBy,
    },
  };
}

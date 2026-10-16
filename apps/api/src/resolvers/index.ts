import type { AnimalCategory } from '@bellwether/risk-engine';
import { requireUser, type GraphQLContext } from '../auth/context';
import type { Animal } from '../repositories/animalRepository';
import type { ForecastService } from '../services/forecastService';
import type { LogInput, PetPatchInput, PetService } from '../services/petService';

type GqlCategory = 'PET' | 'FARM';

const toEngine = (c: GqlCategory): AnimalCategory => (c === 'PET' ? 'pet' : 'farm');
const toGql = (c: AnimalCategory): GqlCategory => (c === 'pet' ? 'PET' : 'FARM');

export interface ResolverDeps {
  forecastService: ForecastService;
  petService: PetService;
}

export function createResolvers({ forecastService, petService }: ResolverDeps) {
  return {
    Query: {
      // Public: reads no user data (A15).
      forecast: (
        _: unknown,
        args: { postcode: string; category: GqlCategory; highExposureHabitat?: boolean | null },
      ) =>
        forecastService.getForecast(args.postcode, toEngine(args.category), {
          highExposureHabitat: args.highExposureHabitat ?? false,
        }),
      animals: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        petService.list(requireUser(ctx).id),
      animal: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        petService.get(requireUser(ctx).id, args.id),
    },

    Mutation: {
      createAnimal: (
        _: unknown,
        args: {
          name: string;
          species: string;
          category: GqlCategory;
          postcode?: string | null;
          highExposureHabitat?: boolean | null;
        },
        ctx: GraphQLContext,
      ) => petService.create(requireUser(ctx).id, { ...args, category: toEngine(args.category) }),
      updateAnimal: (_: unknown, args: { id: string; input: PetPatchInput }, ctx: GraphQLContext) =>
        petService.update(requireUser(ctx).id, args.id, args.input),
      deleteAnimal: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        petService.remove(requireUser(ctx).id, args.id),
      addLogEntry: (
        _: unknown,
        { animalId, ...input }: LogInput & { animalId: string; date: string; type: string },
        ctx: GraphQLContext,
      ) => petService.addLog(requireUser(ctx).id, animalId, input),
      updateLogEntry: (_: unknown, args: { id: string; input: LogInput }, ctx: GraphQLContext) =>
        petService.updateLog(requireUser(ctx).id, args.id, args.input),
      deleteLogEntry: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        petService.removeLog(requireUser(ctx).id, args.id),
    },

    RiskForecast: {
      category: (parent: { category: AnimalCategory }) => toGql(parent.category),
    },

    Animal: {
      category: (parent: Animal) => toGql(parent.category),
      logs: (parent: Animal) => petService.logs(parent.id),
      forecast: (parent: Animal) => petService.forecast(parent),
    },
  };
}

import type { AnimalCategory } from '@bellwether/risk-engine';
import { requireUser, type GraphQLContext } from '../auth/context';
import { appError } from '../errors';
import type { Animal, AnimalRepository } from '../repositories/animalRepository';
import type { ForecastService } from '../services/forecastService';

type GqlCategory = 'PET' | 'FARM';

const toEngine = (c: GqlCategory): AnimalCategory => (c === 'PET' ? 'pet' : 'farm');
const toGql = (c: AnimalCategory): GqlCategory => (c === 'pet' ? 'PET' : 'FARM');

export interface ResolverDeps {
  forecastService: ForecastService;
  animals: AnimalRepository;
}

export function createResolvers({ forecastService, animals }: ResolverDeps) {
  /** The animal, if it belongs to the signed-in user (A15). */
  async function ownAnimal(ctx: GraphQLContext, id: string) {
    const user = requireUser(ctx);
    const animal = await animals.getAnimal(id);
    return animal?.ownerId === user.id ? animal : null;
  }

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
        animals.listAnimals(requireUser(ctx).id),
      animal: (_: unknown, args: { id: string }, ctx: GraphQLContext) => ownAnimal(ctx, args.id),
    },

    Mutation: {
      createAnimal: (
        _: unknown,
        args: { name: string; species: string; category: GqlCategory },
        ctx: GraphQLContext,
      ) => {
        const user = requireUser(ctx);
        const name = args.name.trim();
        if (!name) throw appError('BAD_INPUT', 'Name is required');
        return animals.createAnimal({
          ownerId: user.id,
          name,
          species: args.species.trim(),
          category: toEngine(args.category),
        });
      },
      addLogEntry: async (
        _: unknown,
        args: {
          animalId: string;
          date: string;
          type: string;
          note?: string | null;
          nextDueDate?: string | null;
        },
        ctx: GraphQLContext,
      ) => {
        const animal = await ownAnimal(ctx, args.animalId);
        if (!animal) throw appError('NOT_FOUND', `Animal ${args.animalId} not found`);
        return animals.addLog(args);
      },
      deleteLogEntry: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
        requireUser(ctx);
        const log = await animals.getLog(args.id);
        if (!log || !(await ownAnimal(ctx, log.animalId))) return false;
        return animals.deleteLog(args.id);
      },
    },

    RiskForecast: {
      category: (parent: { category: AnimalCategory }) => toGql(parent.category),
    },

    Animal: {
      category: (parent: Animal) => toGql(parent.category),
      logs: (parent: Animal) => animals.listLogs(parent.id),
    },
  };
}

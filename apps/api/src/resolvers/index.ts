import type { AnimalCategory } from '@animalcast/risk-engine';
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
  return {
    Query: {
      forecast: (
        _: unknown,
        args: { postcode: string; category: GqlCategory; highExposureHabitat?: boolean | null },
      ) =>
        forecastService.getForecast(args.postcode, toEngine(args.category), {
          highExposureHabitat: args.highExposureHabitat ?? false,
        }),
      animals: () => animals.listAnimals(),
      animal: (_: unknown, args: { id: string }) => animals.getAnimal(args.id),
    },

    Mutation: {
      createAnimal: (
        _: unknown,
        args: { name: string; species: string; category: GqlCategory },
      ) => {
        const name = args.name.trim();
        if (!name) throw appError('BAD_INPUT', 'Name is required');
        return animals.createAnimal({
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
      ) => {
        const animal = await animals.getAnimal(args.animalId);
        if (!animal) throw appError('NOT_FOUND', `Animal ${args.animalId} not found`);
        return animals.addLog(args);
      },
      deleteLogEntry: (_: unknown, args: { id: string }) => animals.deleteLog(args.id),
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

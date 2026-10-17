import type { AnimalCategory } from '@bellwether/risk-engine';
import { isIsoDate, londonToday } from '../dates';
import { walkPlan } from '../domain/walkPlanner';
import { appError } from '../errors';
import type {
  Animal,
  AnimalRepository,
  LogEntry,
  LogEntryPatch,
} from '../repositories/animalRepository';
import type { ForecastService } from './forecastService';
import type { LocationService } from './locationService';

export interface PetDeps {
  animals: AnimalRepository;
  locations: LocationService;
  forecastService: ForecastService;
  now?: () => Date;
}

export interface NewPetInput {
  name: string;
  species: string;
  category: AnimalCategory;
  postcode?: string | null;
  highExposureHabitat?: boolean | null;
}

export interface PetPatchInput {
  name?: string | null;
  postcode?: string | null;
  highExposureHabitat?: boolean | null;
}

export interface LogInput {
  date?: string | null;
  type?: string | null;
  note?: string | null;
  nextDueDate?: string | null;
  /** v3; null clears */
  weightKg?: number | null;
}

/** Sanity limit to catch typos, not a veterinary value */
const MAX_PET_WEIGHT_KG = 150;

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw appError('BAD_INPUT', 'Name is required');
  return trimmed;
}

/** Pets and their logs (FR-2.6). Every call is scoped to the owner: other people's pets are "not found". */
export function createPetService(deps: PetDeps) {
  const { animals, locations } = deps;

  /** Validates and normalises a postcode against postcodes.io, so the pet's forecast will work. */
  const checkedPostcode = async (raw: string | null | undefined) => {
    if (raw === undefined) return undefined;
    if (raw === null || !raw.trim()) return null;
    return (await locations.findPostcode(raw)).postcode;
  };

  async function ownAnimal(ownerId: string, id: string): Promise<Animal | null> {
    const animal = await animals.getAnimal(id);
    return animal?.ownerId === ownerId ? animal : null;
  }

  async function requireAnimal(ownerId: string, id: string) {
    const animal = await ownAnimal(ownerId, id);
    if (!animal) throw appError('NOT_FOUND', `Animal ${id} not found`);
    return animal;
  }

  async function ownLog(ownerId: string, id: string): Promise<LogEntry | null> {
    const log = await animals.getLog(id);
    return log && (await ownAnimal(ownerId, log.animalId)) ? log : null;
  }

  /** The log entry after applying `input`, checked as a whole. */
  function checkedLog(current: Pick<LogEntry, 'date' | 'nextDueDate'>, input: LogInput) {
    const patch: LogEntryPatch = {};
    if (input.date != null) patch.date = input.date;
    if (input.type != null) {
      patch.type = input.type.trim();
      if (!patch.type) throw appError('BAD_INPUT', 'Say what was done');
    }
    if (input.note !== undefined) patch.note = input.note?.trim() || null;
    if (input.nextDueDate !== undefined) patch.nextDueDate = input.nextDueDate || null;
    if (input.weightKg !== undefined) {
      if (input.weightKg !== null && !(input.weightKg > 0 && input.weightKg <= MAX_PET_WEIGHT_KG))
        throw appError('BAD_INPUT', `Weight must be more than 0 and up to ${MAX_PET_WEIGHT_KG} kg`);
      patch.weightKg = input.weightKg === null ? null : Math.round(input.weightKg * 10) / 10;
    }

    const date = patch.date ?? current.date;
    const due = patch.nextDueDate === undefined ? current.nextDueDate : patch.nextDueDate;
    if (!isIsoDate(date)) throw appError('BAD_INPUT', 'Date must be YYYY-MM-DD');
    if (due !== null) {
      if (!isIsoDate(due)) throw appError('BAD_INPUT', 'Next due date must be YYYY-MM-DD');
      if (due < date) throw appError('BAD_INPUT', 'Next due date cannot be before the entry date');
    }
    return patch;
  }

  return {
    list: (ownerId: string) => animals.listAnimals(ownerId),
    get: ownAnimal,

    async create(ownerId: string, input: NewPetInput) {
      return animals.createAnimal({
        ownerId,
        name: cleanName(input.name),
        species: input.species.trim().toLowerCase(),
        category: input.category,
        postcode: (await checkedPostcode(input.postcode)) ?? null,
        highExposureHabitat: input.highExposureHabitat ?? false,
      });
    },

    async update(ownerId: string, id: string, input: PetPatchInput) {
      await requireAnimal(ownerId, id);
      const updated = await animals.updateAnimal(id, {
        name: input.name == null ? undefined : cleanName(input.name),
        postcode: await checkedPostcode(input.postcode),
        highExposureHabitat: input.highExposureHabitat ?? undefined,
      });
      if (!updated) throw appError('NOT_FOUND', `Animal ${id} not found`);
      return updated;
    },

    async remove(ownerId: string, id: string) {
      return (await ownAnimal(ownerId, id)) ? animals.deleteAnimal(id) : false;
    },

    /** The pet's own forecast: the risks for its species at its postcode, or null without one. */
    async forecast(animal: Animal) {
      if (!animal.postcode) return null;
      const forecast = await deps.forecastService.getForecast(animal.postcode, animal.category, {
        highExposureHabitat: animal.highExposureHabitat,
      });
      return {
        ...forecast,
        risks: forecast.risks.filter((r) => r.animals.includes(animal.species)),
      };
    },

    /** v3: today's best hours for a dog walk at its postcode; null without hourly data. */
    async walkPlanner(animal: Animal) {
      if (!animal.postcode || animal.species !== 'dog') return null;
      const { latitude, longitude } = await locations.findPostcode(animal.postcode);
      const days = await deps.forecastService.getDaysAt(latitude, longitude);
      return walkPlan(days, londonToday((deps.now ?? (() => new Date()))()));
    },

    logs: (animalId: string) => animals.listLogs(animalId),

    async addLog(
      ownerId: string,
      animalId: string,
      input: LogInput & { date: string; type: string },
    ) {
      await requireAnimal(ownerId, animalId);
      const patch = checkedLog({ date: input.date, nextDueDate: null }, input);
      return animals.addLog({ animalId, date: input.date, type: input.type, ...patch });
    },

    async updateLog(ownerId: string, id: string, input: LogInput) {
      const log = await ownLog(ownerId, id);
      if (!log) throw appError('NOT_FOUND', `Log entry ${id} not found`);
      const updated = await animals.updateLog(id, checkedLog(log, input));
      if (!updated) throw appError('NOT_FOUND', `Log entry ${id} not found`);
      return updated;
    },

    async removeLog(ownerId: string, id: string) {
      return (await ownLog(ownerId, id)) ? animals.deleteLog(id) : false;
    },
  };
}

export type PetService = ReturnType<typeof createPetService>;

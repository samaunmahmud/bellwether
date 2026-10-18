import { requireUser, type GraphQLContext } from '../auth/context';
import type { LivestockGroup } from '../domain/farm';
import type { Contact, StoredDocument, TaggedAnimal } from '../domain/keeping';
import type { Animal, AnimalRepository } from '../repositories/animalRepository';
import type { FarmRepository } from '../repositories/farmRepository';
import type {
  ContactInput,
  DocumentInput,
  DocumentUpdate,
  KeepingService,
  TaggedAnimalInput,
  TaggedAnimalUpdate,
} from '../services/keepingService';

export interface KeepingResolverDeps {
  farms: FarmRepository;
  animals: AnimalRepository;
  keepingService: KeepingService;
}

/** v4: contacts, emergency numbers, tagged animals and documents. */
export function createKeepingResolvers({ farms, animals, keepingService }: KeepingResolverDeps) {
  return {
    Query: {
      contacts: (_: unknown, args: { farmId?: string | null }, ctx: GraphQLContext) =>
        keepingService.contacts(requireUser(ctx).id, args.farmId),
      emergencyContacts: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        keepingService.emergencyContacts(requireUser(ctx).id),
      taggedAnimals: (_: unknown, args: { farmId: string }, ctx: GraphQLContext) =>
        keepingService.taggedAnimals(requireUser(ctx).id, args.farmId),
      documents: (
        _: unknown,
        args: { farmId?: string | null; petId?: string | null },
        ctx: GraphQLContext,
      ) => keepingService.documents(requireUser(ctx).id, args),
      documentFile: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        keepingService.documentFile(requireUser(ctx).id, args.id),
      expiringDocuments: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        keepingService.expiringDocuments(requireUser(ctx).id),
    },
    Mutation: {
      addContact: (_: unknown, args: { input: ContactInput }, ctx: GraphQLContext) =>
        keepingService.addContact(requireUser(ctx).id, args.input),
      updateContact: (_: unknown, args: { id: string; input: ContactInput }, ctx: GraphQLContext) =>
        keepingService.updateContact(requireUser(ctx).id, args.id, args.input),
      deleteContact: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        keepingService.deleteContact(requireUser(ctx).id, args.id),
      addTaggedAnimal: (_: unknown, args: { input: TaggedAnimalInput }, ctx: GraphQLContext) =>
        keepingService.addTaggedAnimal(requireUser(ctx).id, args.input),
      updateTaggedAnimal: (
        _: unknown,
        args: { id: string; input: TaggedAnimalUpdate },
        ctx: GraphQLContext,
      ) => keepingService.updateTaggedAnimal(requireUser(ctx).id, args.id, args.input),
      deleteTaggedAnimal: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        keepingService.deleteTaggedAnimal(requireUser(ctx).id, args.id),
      addDocument: (_: unknown, args: { input: DocumentInput }, ctx: GraphQLContext) =>
        keepingService.addDocument(requireUser(ctx).id, args.input),
      updateDocument: (
        _: unknown,
        args: { id: string; input: DocumentUpdate },
        ctx: GraphQLContext,
      ) => keepingService.updateDocument(requireUser(ctx).id, args.id, args.input),
      deleteDocument: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        keepingService.deleteDocument(requireUser(ctx).id, args.id),
    },
    // Only reached for a document the caller was already allowed to see.
    Document: {
      daysToExpiry: (d: StoredDocument) => keepingService.daysToExpiry(d),
      farmName: async (d: StoredDocument) =>
        d.farmId ? ((await farms.getFarm(d.farmId))?.name ?? null) : null,
      petName: async (d: StoredDocument) =>
        d.petId ? ((await animals.getAnimal(d.petId))?.name ?? null) : null,
      group: async (d: StoredDocument) => (d.groupId ? farms.getGroup(d.groupId) : null),
      taggedAnimal: async (d: StoredDocument) =>
        d.taggedAnimalId ? keepingService.taggedById(d.taggedAnimalId) : null,
    },
    Animal: {
      documents: (a: Animal) => keepingService.petDocuments(a.id),
    },
    // Only reached for an animal or group the caller was already allowed to see.
    TaggedAnimal: {
      group: async (a: TaggedAnimal) => (a.groupId ? farms.getGroup(a.groupId) : null),
      ageMonths: (a: TaggedAnimal) => keepingService.ageMonths(a),
    },
    LivestockGroup: {
      taggedAnimals: (g: LivestockGroup) => keepingService.taggedInGroup(g.farmId, g.id),
    },
    // Only reached for a contact the caller was already allowed to see.
    Contact: {
      farmName: async (c: Contact) =>
        c.farmId ? ((await farms.getFarm(c.farmId))?.name ?? null) : null,
    },
  };
}

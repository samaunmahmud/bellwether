import { requireUser, type GraphQLContext } from '../auth/context';
import type { LivestockGroup } from '../domain/farm';
import type { Contact, TaggedAnimal } from '../domain/keeping';
import type { FarmRepository } from '../repositories/farmRepository';
import type {
  ContactInput,
  KeepingService,
  TaggedAnimalInput,
  TaggedAnimalUpdate,
} from '../services/keepingService';

export interface KeepingResolverDeps {
  farms: FarmRepository;
  keepingService: KeepingService;
}

/** v4: contacts, emergency numbers and tagged animals. */
export function createKeepingResolvers({ farms, keepingService }: KeepingResolverDeps) {
  return {
    Query: {
      contacts: (_: unknown, args: { farmId?: string | null }, ctx: GraphQLContext) =>
        keepingService.contacts(requireUser(ctx).id, args.farmId),
      emergencyContacts: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        keepingService.emergencyContacts(requireUser(ctx).id),
      taggedAnimals: (_: unknown, args: { farmId: string }, ctx: GraphQLContext) =>
        keepingService.taggedAnimals(requireUser(ctx).id, args.farmId),
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

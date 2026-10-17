import { requireUser, type GraphQLContext } from '../auth/context';
import type { Contact } from '../domain/keeping';
import type { FarmRepository } from '../repositories/farmRepository';
import type { ContactInput, KeepingService } from '../services/keepingService';

export interface KeepingResolverDeps {
  farms: FarmRepository;
  keepingService: KeepingService;
}

/** v4: contacts and emergency numbers. */
export function createKeepingResolvers({ farms, keepingService }: KeepingResolverDeps) {
  return {
    Query: {
      contacts: (_: unknown, args: { farmId?: string | null }, ctx: GraphQLContext) =>
        keepingService.contacts(requireUser(ctx).id, args.farmId),
      emergencyContacts: (_: unknown, __: unknown, ctx: GraphQLContext) =>
        keepingService.emergencyContacts(requireUser(ctx).id),
    },
    Mutation: {
      addContact: (_: unknown, args: { input: ContactInput }, ctx: GraphQLContext) =>
        keepingService.addContact(requireUser(ctx).id, args.input),
      updateContact: (_: unknown, args: { id: string; input: ContactInput }, ctx: GraphQLContext) =>
        keepingService.updateContact(requireUser(ctx).id, args.id, args.input),
      deleteContact: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
        keepingService.deleteContact(requireUser(ctx).id, args.id),
    },
    // Only reached for a contact the caller was already allowed to see.
    Contact: {
      farmName: async (c: Contact) =>
        c.farmId ? ((await farms.getFarm(c.farmId))?.name ?? null) : null,
    },
  };
}

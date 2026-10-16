import { getOrLoad, TTL, type Cache } from '../cache/cache';
import type { Location, PostcodeClient } from '../clients/postcodesClient';
import { appError } from '../errors';
import type { Logger } from '../logger';
import { normalisePostcode } from '../postcode';

export interface LocationDeps {
  postcodes: PostcodeClient;
  cache: Cache;
  logger: Logger;
}

export function createLocationService(deps: LocationDeps) {
  return {
    /** Validates, normalises and looks up a UK postcode (cached). Throws a user-facing error if it can't. */
    async findPostcode(rawPostcode: string): Promise<Location> {
      const postcode = normalisePostcode(rawPostcode);
      if (!postcode)
        throw appError('INVALID_POSTCODE', `"${rawPostcode}" is not a valid UK postcode`);

      let location: Location | null;
      try {
        location = await getOrLoad(
          deps.cache,
          `postcode:${postcode}`,
          TTL.postcode,
          () => deps.postcodes.lookup(postcode),
          deps.logger,
        );
      } catch {
        throw appError(
          'UPSTREAM_UNAVAILABLE',
          'Postcode lookup is unavailable right now. Please try again.',
        );
      }
      if (!location) throw appError('POSTCODE_NOT_FOUND', `Postcode ${postcode} was not found`);
      return location;
    },
  };
}

export type LocationService = ReturnType<typeof createLocationService>;

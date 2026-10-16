const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids are Postgres UUIDs, and Postgres rejects anything else with an error. Ids come from
 * clients, so a malformed one must mean "not found", not a server error.
 */
export const isUuid = (id: string) => UUID.test(id);

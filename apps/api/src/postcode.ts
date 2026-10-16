// Broad UK postcode shape check (outward code + inward code). It filters obvious
// junk before we call the lookup API; the API decides whether it really exists.
const UK_POSTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;

/** Uppercase, strip spaces and re-insert the single space before the inward code. Returns null if invalid. */
export function normalisePostcode(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, '');
  if (!UK_POSTCODE.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

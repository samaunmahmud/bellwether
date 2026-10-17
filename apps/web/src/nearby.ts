/**
 * v4: help near a postcode. Searches open OpenStreetMap rather than naming any business, so
 * Bellwether never recommends a company (CLAUDE.md, no branding or product advice).
 */

/** The Royal College of Veterinary Surgeons' public register of practices. */
export const FIND_A_VET_URL = 'https://findavet.rcvs.org.uk/';

const SEARCHES = {
  farm: [
    ['Vets', 'veterinary'],
    ['Agricultural and feed merchants', 'agricultural supplies'],
    ['Livestock markets', 'livestock market'],
  ],
  pet: [
    ['Vets', 'veterinary'],
    ['Pet shops', 'pet shop'],
  ],
} as const;

export function nearbySearches(postcode: string, kind: 'farm' | 'pet') {
  return SEARCHES[kind].map(([label, term]) => ({
    label,
    url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${term} near ${postcode}`)}`,
  }));
}

/** A phone number as a link a phone can dial: digits and a leading +, "(0)" dropped. */
export function telHref(phone: string) {
  return `tel:${phone.replace(/\(0\)/g, '0').replace(/[^\d+]/g, '')}`;
}

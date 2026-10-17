import { FIND_A_VET_URL, nearbySearches, telHref } from '../src/nearby';

describe('finding help nearby (v4)', () => {
  it('builds OpenStreetMap searches around a postcode, for farms and for pets', () => {
    const farm = nearbySearches('LA9 4DQ', 'farm');
    expect(farm.map((s) => s.label)).toEqual([
      'Vets',
      'Agricultural and feed merchants',
      'Livestock markets',
    ]);
    expect(farm[0]!.url).toBe(
      'https://www.openstreetmap.org/search?query=veterinary%20near%20LA9%204DQ',
    );
    expect(nearbySearches('UB8 3PH', 'pet').map((s) => s.label)).toEqual(['Vets', 'Pet shops']);
  });

  it('links to the official register of vets', () => {
    expect(FIND_A_VET_URL).toMatch(/^https:\/\/findavet\.rcvs\.org\.uk/);
  });

  it('makes phone numbers dialable', () => {
    expect(telHref('01539 000 000')).toBe('tel:01539000000');
    expect(telHref('+44 (0)1539-000000')).toBe('tel:+4401539000000');
  });
});

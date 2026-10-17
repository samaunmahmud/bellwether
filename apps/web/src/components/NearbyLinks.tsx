import { nearbySearches } from '../nearby';
import { Icon } from './Icon';

/** v4: map searches around a postcode. Opens OpenStreetMap; Bellwether names no businesses. */
export function NearbyLinks({
  postcode,
  kind,
  place,
}: {
  postcode: string;
  kind: 'farm' | 'pet';
  place?: string;
}) {
  return (
    <ul className="nearby">
      {nearbySearches(postcode, kind).map((s) => (
        <li key={s.label}>
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            <Icon name="pin" size={18} />
            <span>
              {s.label} near {place ?? postcode}
            </span>
            <Icon name="arrow" size={16} />
          </a>
        </li>
      ))}
    </ul>
  );
}

import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { formatAge } from '../dates';
import { GROUP_TAGGED_QUERY } from '../graphql/keeping';

interface Data {
  livestockGroup: {
    id: string;
    taggedAnimals: Array<{
      id: string;
      tag: string;
      name: string | null;
      ageMonths: number | null;
    }>;
  } | null;
}

/** v4: the group's tagged animals still on the farm. Shows nothing while loading or if none. */
export function GroupTaggedAnimals({ groupId, farmId }: { groupId: string; farmId: string }) {
  const { data } = useQuery<Data>(GROUP_TAGGED_QUERY, { variables: { id: groupId } });
  const animals = data?.livestockGroup?.taggedAnimals ?? [];
  if (animals.length === 0) return null;
  return (
    <section aria-label="Tagged animals in this group" className="group-tagged">
      <h2>Tagged animals ({animals.length})</h2>
      <ul className="chip-list">
        {animals.map((a) => (
          <li key={a.id} className="chip">
            <strong>{a.name ?? a.tag}</strong>
            {a.name && <span className="muted"> {a.tag}</span>}
            {a.ageMonths !== null && <span className="muted"> · {formatAge(a.ageMonths)}</span>}
          </li>
        ))}
      </ul>
      <p>
        <Link to={`/farms/${farmId}/animals`}>All tagged animals on the farm</Link>
      </p>
    </section>
  );
}

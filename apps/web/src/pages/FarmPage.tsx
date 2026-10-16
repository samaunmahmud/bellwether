import { useMutation, useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { FieldForm, type FieldFormValues } from '../components/FieldForm';
import { CLASS_LABELS, GroupForm, type GroupFormValues } from '../components/GroupForm';
import { MoveGroupForm } from '../components/MoveGroupForm';
import { dayMonth, shortDay } from '../dates';
import { CREATE_FIELD, CREATE_GROUP, FARM_QUERY, MOVE_GROUP } from '../graphql/farms';
import type { Farm, Field, LivestockGroup } from '../types';

/** The later of the meat and milk withdrawal end dates. */
const latestEnd = (w: { meatEnds: string | null; milkEnds: string | null }) =>
  [w.meatEnds, w.milkEnds]
    .filter((d): d is string => d !== null)
    .sort()
    .at(-1)!;

/** Where a field's weather comes from (FR-2.2). */
function fieldLocation(field: Field): string {
  if (field.latitude !== null && field.longitude !== null)
    return `Map pin ${field.latitude}, ${field.longitude}`;
  return field.postcode ?? 'Uses farm postcode';
}

function groupSummary(group: LivestockGroup): string {
  const where = group.housed
    ? 'housed'
    : group.currentField
      ? `in ${group.currentField.name}`
      : 'no field yet';
  return `${group.headCount} ${CLASS_LABELS[group.livestockClass].toLowerCase()} · ${where}`;
}

const period = (label: string, start: string | null, end: string | null) =>
  start && end ? `${label} ${dayMonth(start)} – ${dayMonth(end)}` : null;

function groupDetails(group: LivestockGroup): string {
  const details =
    group.species === 'SHEEP'
      ? [
          group.lastShearingDate && `Shorn ${dayMonth(group.lastShearingDate)}`,
          period('Lambing', group.lambingStart, group.lambingEnd),
          group.lambsAtGrassThisSpring && 'Lambs at grass',
        ]
      : [
          group.cattleType === 'DAIRY' ? 'Dairy' : group.cattleType === 'BEEF' ? 'Beef' : null,
          period('Calving', group.calvingStart, group.calvingEnd),
        ];
  return details.filter(Boolean).join(' · ');
}

/** One farm: its fields and livestock groups, with forms to add and move them (FR-2). */
export function FarmPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<{ farm: Farm | null }>(FARM_QUERY, {
    variables: { id },
  });
  const refetch = { refetchQueries: [{ query: FARM_QUERY, variables: { id } }] };
  const [createField] = useMutation(CREATE_FIELD, refetch);
  const [createGroup] = useMutation(CREATE_GROUP, refetch);
  const [moveGroup] = useMutation(MOVE_GROUP, refetch);

  if (loading) return <p aria-live="polite">Loading farm…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;

  const fieldOptions = farm.fields.map(({ id: fieldId, name }) => ({ id: fieldId, name }));

  return (
    <section>
      <h1>{farm.name}</h1>
      <p className="muted">{farm.postcode}</p>
      <p className="actions">
        <Link to={`/farms/${farm.id}/briefing`} className="button">
          Morning briefing
        </Link>
        <Link to={`/farms/${farm.id}/records`}>Treatment records</Link>
      </p>

      <h2>Fields</h2>
      {farm.fields.length === 0 ? (
        <p className="muted">No fields yet. Groups without a field use the farm postcode.</p>
      ) : (
        <ul className="list" aria-label="Fields">
          {farm.fields.map((field) => (
            <li key={field.id}>
              <strong>{field.name}</strong> <span className="muted">{fieldLocation(field)}</span>
            </li>
          ))}
        </ul>
      )}
      <FieldForm
        onSubmit={(values: FieldFormValues) =>
          createField({ variables: { input: { farmId: farm.id, ...values } } })
        }
      />

      <h2>Livestock groups</h2>
      {farm.groups.length === 0 && <p className="muted">No groups yet.</p>}
      <div className="grid">
        {farm.groups.map((group) => (
          <article key={group.id} className="card" aria-labelledby={`group-${group.id}`}>
            <h3 id={`group-${group.id}`}>{group.name}</h3>
            <p>{groupSummary(group)}</p>
            {group.withdrawal.inWithdrawal && (
              <p className="withdrawal withdrawal--active">
                {`In withdrawal until ${shortDay(latestEnd(group.withdrawal))}`}
              </p>
            )}
            <p>
              <Link to={`/groups/${group.id}`} aria-label={`Records for ${group.name}`}>
                Treatments and checks
              </Link>
            </p>
            {groupDetails(group) && <p className="muted">{groupDetails(group)}</p>}

            <MoveGroupForm
              groupName={group.name}
              fields={fieldOptions}
              currentFieldId={group.currentField?.id ?? null}
              onSubmit={(values) =>
                moveGroup({ variables: { input: { groupId: group.id, ...values } } })
              }
            />

            {group.movements.length > 0 && (
              <ul className="log" aria-label="Move history">
                {group.movements.map((m) => (
                  <li key={m.id} className="log__row">
                    <span>
                      {m.fromField
                        ? `${m.fromField.name} → ${m.toField.name}`
                        : `Into ${m.toField.name}`}
                    </span>
                    <span className="muted">{dayMonth(m.movedOn)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <h2>Add a group</h2>
      <GroupForm
        fields={fieldOptions}
        onSubmit={(values: GroupFormValues) =>
          createGroup({ variables: { input: { farmId: farm.id, ...values } } })
        }
      />
    </section>
  );
}

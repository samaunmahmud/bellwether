import { useMutation, useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { FieldForm, type FieldFormValues } from '../components/FieldForm';
import { CLASS_LABELS, GroupForm, type GroupFormValues } from '../components/GroupForm';
import { CountUp } from '../components/CountUp';
import { Icon } from '../components/Icon';
import { MoveGroupForm } from '../components/MoveGroupForm';
import { farmPhoto, Photo } from '../components/photos';
import { dayMonth, shortDay } from '../dates';
import { CREATE_FIELD, CREATE_GROUP, FARM_QUERY, MOVE_GROUP } from '../graphql/farms';
import { canManage, canWork } from '../roles';
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

/**
 * One farm: its fields and livestock groups, with forms to add and move them (FR-2).
 * Forms show only to members allowed to use them (FR-8.2).
 */
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
  const owner = canManage(farm.myRole);
  const worker = canWork(farm.myRole);

  const totalHead = farm.groups.reduce((n, g) => n + g.headCount, 0);
  const sheep = farm.groups
    .filter((g) => g.species === 'SHEEP')
    .reduce((n, g) => n + g.headCount, 0);
  const groupsIn = (fieldId: string) =>
    farm.groups.filter((g) => !g.housed && g.currentField?.id === fieldId);

  return (
    <section className="livestock">
      <header className="page-hero page-hero--compact">
        <Photo name={farmPhoto({ sheep, cattle: totalHead - sheep })} className="photo--drift" />
        <div className="page-hero__inner">
          <p className="eyebrow">Livestock and fields</p>
          <h1>{farm.name}</h1>
          <p>
            {farm.postcode} · {farm.groups.length} {farm.groups.length === 1 ? 'group' : 'groups'} ·{' '}
            {totalHead.toLocaleString('en-GB')} animals · {farm.fields.length}{' '}
            {farm.fields.length === 1 ? 'field' : 'fields'}
          </p>
        </div>
      </header>
      {!worker && <p className="muted">You can view this farm but not make changes.</p>}
      <nav className="pill-nav" aria-label="Farm pages">
        <Link to={`/farms/${farm.id}/briefing`} className="button">
          Morning briefing
        </Link>
        <Link to={`/farms/${farm.id}/tasks`} className="button button--secondary">
          Tasks
        </Link>
        <Link to={`/farms/${farm.id}/records`}>Treatment records</Link>
        <Link to={`/farms/${farm.id}/people`}>People</Link>
        {owner && <Link to={`/farms/${farm.id}/settings`}>Farm settings</Link>}
      </nav>

      <h2>Livestock groups</h2>
      {farm.groups.length === 0 && <p className="empty">No groups yet.</p>}
      <div className="group-cards">
        {farm.groups.map((group, i) => (
          <article
            key={group.id}
            className={`group-card group-card--${group.species.toLowerCase()}`}
            aria-labelledby={`group-${group.id}`}
            style={{ ['--i' as string]: i }}
          >
            <div className="group-card__top">
              <span className="group-card__avatar" aria-hidden="true">
                <Icon name="livestock" size={24} />
              </span>
              <div className="group-card__title">
                <h3 id={`group-${group.id}`}>{group.name}</h3>
                <span className="muted">{group.species === 'SHEEP' ? 'Sheep' : 'Cattle'}</span>
              </div>
              <span className="group-card__count" aria-hidden="true">
                <CountUp value={group.headCount} />
              </span>
            </div>
            <p className="group-card__summary">{groupSummary(group)}</p>
            {group.withdrawal.inWithdrawal ? (
              <p className="withdrawal withdrawal--active">
                {`In withdrawal until ${shortDay(latestEnd(group.withdrawal))}`}
              </p>
            ) : (
              <p className="tag tag--quiet">Not in withdrawal</p>
            )}
            {groupDetails(group) && <p className="muted">{groupDetails(group)}</p>}
            <p>
              <Link
                to={`/groups/${group.id}`}
                className="button button--secondary group-card__open"
                aria-label={`Records for ${group.name}`}
              >
                Treatments and checks <Icon name="arrow" size={18} />
              </Link>
            </p>

            {worker && (
              <details className="group-card__move">
                <summary>
                  <Icon name="arrow" size={16} /> Move to another field
                </summary>
                <MoveGroupForm
                  groupName={group.name}
                  fields={fieldOptions}
                  currentFieldId={group.currentField?.id ?? null}
                  onSubmit={(values) =>
                    moveGroup({ variables: { input: { groupId: group.id, ...values } } })
                  }
                />
              </details>
            )}

            {group.movements.length > 0 && (
              <ul className="move-trail" aria-label="Move history">
                {group.movements.map((m) => (
                  <li key={m.id}>
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

      <div className="panel__head">
        <h2>Fields</h2>
        <Link to={`/farms/${farm.id}/map`}>
          <Icon name="map" size={18} /> Open the map
        </Link>
      </div>
      {farm.fields.length === 0 ? (
        <p className="empty">No fields yet. Groups without a field use the farm postcode.</p>
      ) : (
        <ul className="field-cards" aria-label="Fields">
          {farm.fields.map((field) => {
            const grazing = groupsIn(field.id);
            return (
              <li key={field.id} className={grazing.length ? 'field-card is-grazed' : 'field-card'}>
                <span className="field-card__icon" aria-hidden="true">
                  <Icon name="map" size={20} />
                </span>
                <span className="field-card__body">
                  <strong>{field.name}</strong>{' '}
                  <span className="muted">{fieldLocation(field)}</span>
                  <span className="field-card__who">
                    {grazing.length
                      ? `Grazing: ${grazing.map((g) => g.name).join(', ')}`
                      : 'Resting'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {owner && (
        <section className="panel" aria-label="Add a field">
          <h3>Add a field</h3>
          <FieldForm
            onSubmit={(values: FieldFormValues) =>
              createField({ variables: { input: { farmId: farm.id, ...values } } })
            }
          />
        </section>
      )}

      {owner && (
        <section className="panel">
          <h2>Add a group</h2>
          <GroupForm
            fields={fieldOptions}
            onSubmit={(values: GroupFormValues) =>
              createGroup({ variables: { input: { farmId: farm.id, ...values } } })
            }
          />
        </section>
      )}
    </section>
  );
}

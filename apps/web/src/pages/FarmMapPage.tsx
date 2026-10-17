import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { PageHero } from '../components/photos';
import { Link, useParams } from 'react-router-dom';
import { FieldMap, type MapField } from '../components/FieldMap';
import { useToast } from '../components/Toasts';
import { errorMessage } from '../errors';
import { MAP_QUERY, SET_FIELD_PIN } from '../graphql/v3';
import { canManage } from '../roles';
import type { FarmRole, GrazingStatus } from '../types';

interface MapFarm {
  id: string;
  name: string;
  myRole: FarmRole;
  location: { latitude: number; longitude: number };
  fields: Array<MapField & { postcode: string | null }>;
}

export const GRAZING_WORD: Record<GrazingStatus, string> = {
  GRAZED: 'Grazed',
  RESTING: 'Resting',
  NEVER_USED: 'Not used yet',
};

export function grazingText(g: MapField['grazing']) {
  if (g.status === 'GRAZED')
    return `${g.groups.join(', ')} in for ${g.days ?? '?'} ${g.days === 1 ? 'day' : 'days'}`;
  if (g.status === 'RESTING')
    return g.days === null ? 'Resting' : `Rested for ${g.days} ${g.days === 1 ? 'day' : 'days'}`;
  return 'No moves recorded';
}

/** v3: the farm's fields on a map, coloured and labelled by grazing, with click-to-pin. */
export function FarmMapPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, loading, error } = useQuery<{ farm: MapFarm | null }>(MAP_QUERY, {
    variables: { id },
  });
  const [setPin] = useMutation(SET_FIELD_PIN, {
    refetchQueries: [{ query: MAP_QUERY, variables: { id } }],
  });
  const [placing, setPlacing] = useState<string | null>(null);

  if (loading) return <p aria-live="polite">Loading the map…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;
  const owner = canManage(farm.myRole);
  const placingField = farm.fields.find((f) => f.id === placing);

  async function place(latitude: number, longitude: number) {
    if (!placingField) return;
    try {
      await setPin({
        variables: {
          id: placingField.id,
          input: {
            latitude: Math.round(latitude * 10000) / 10000,
            longitude: Math.round(longitude * 10000) / 10000,
          },
        },
      });
      toast(`${placingField.name} pinned on the map`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
    setPlacing(null);
  }

  const pinned = farm.fields.filter((f) => f.latitude !== null && f.longitude !== null);
  const resting = farm.fields
    .filter((f) => f.grazing.status === 'RESTING' && f.grazing.days !== null)
    .sort((a, b) => (b.grazing.days ?? 0) - (a.grazing.days ?? 0));

  return (
    <section>
      <PageHero photo="aerial" eyebrow={<Link to={`/farms/${farm.id}`}>{farm.name}</Link>}>
        <div>
          <h1>Farm map</h1>
          <p className="lead">
            {pinned.length} of {farm.fields.length} fields pinned.
            {resting[0] && ` Longest rested: ${resting[0].name} (${resting[0].grazing.days} days).`}
          </p>
        </div>
      </PageHero>

      {placingField && (
        <p className="notice" role="status">
          Click the map where <strong>{placingField.name}</strong> is.{' '}
          <button type="button" className="link-button" onClick={() => setPlacing(null)}>
            Cancel
          </button>
        </p>
      )}

      <div className="map-layout">
        <div className={`map-frame${placingField ? ' map-frame--placing' : ''}`}>
          <FieldMap
            center={farm.location}
            fields={farm.fields}
            onPick={placingField ? place : undefined}
          />
          <ul className="map-legend" aria-label="Key">
            {(Object.keys(GRAZING_WORD) as GrazingStatus[]).map((s) => (
              <li key={s}>
                <span className={`map-dot map-dot--${s.toLowerCase()}`} aria-hidden="true" />
                {GRAZING_WORD[s]}
              </li>
            ))}
          </ul>
        </div>

        <section className="panel" aria-labelledby="fields-heading">
          <h2 id="fields-heading">Fields and grazing</h2>
          {farm.fields.length === 0 ? (
            <p className="empty">
              No fields yet. <Link to={`/farms/${farm.id}/livestock`}>Add fields</Link> to see them
              here.
            </p>
          ) : (
            <ul className="field-list">
              {farm.fields.map((f) => (
                <li key={f.id}>
                  <div>
                    <strong>{f.name}</strong>
                    <span className={`grazing grazing--${f.grazing.status.toLowerCase()}`}>
                      {GRAZING_WORD[f.grazing.status]}
                    </span>
                    <p className="muted">{grazingText(f.grazing)}</p>
                    {f.latitude === null && (
                      <p className="muted">
                        {f.postcode
                          ? `Weather from ${f.postcode}`
                          : 'Not pinned: uses the farm postcode'}
                      </p>
                    )}
                  </div>
                  {owner && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setPlacing(f.id)}
                      aria-label={`${f.latitude === null ? 'Pin' : 'Move pin for'} ${f.name}`}
                    >
                      {f.latitude === null ? 'Pin on map' : 'Move pin'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

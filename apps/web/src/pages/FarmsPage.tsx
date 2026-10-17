import { useMutation, useQuery } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Invitations } from '../components/Invitations';
import { errorMessage } from '../errors';
import { CREATE_FARM, FARMS_QUERY } from '../graphql/farms';
import { CREATE_DEMO_FARM } from '../graphql/v3';
import { Icon } from '../components/Icon';
import { ROLE_LABELS } from '../roles';
import type { FarmSummary } from '../types';

/** FR-2.1: the signed-in user's farms, and a form to add one. */
export function FarmsPage() {
  const { data, loading, error } = useQuery<{ farms: FarmSummary[] }>(FARMS_QUERY);
  const [createFarm] = useMutation(CREATE_FARM, { refetchQueries: [{ query: FARMS_QUERY }] });

  const [name, setName] = useState('');
  const [postcode, setPostcode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [createDemo, demoState] = useMutation<{ createDemoFarm: { id: string } }>(
    CREATE_DEMO_FARM,
    {
      refetchQueries: [{ query: FARMS_QUERY }],
    },
  );
  const [demoPostcode, setDemoPostcode] = useState('LA9 4DQ');
  const [demoError, setDemoError] = useState<string | null>(null);

  async function handleDemo(e: FormEvent) {
    e.preventDefault();
    setDemoError(null);
    try {
      const res = await createDemo({ variables: { postcode: demoPostcode.trim() } });
      if (res.data) navigate(`/farms/${res.data.createDemoFarm.id}`);
    } catch (err) {
      setDemoError(errorMessage(err));
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await createFarm({ variables: { input: { name: name.trim(), postcode: postcode.trim() } } });
      setName('');
      setPostcode('');
    } catch (err) {
      setFormError(errorMessage(err));
    }
  }

  return (
    <section>
      <h1>My farms</h1>
      <Invitations />

      {loading && <p aria-live="polite">Loading farms…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && data.farms.length === 0 && (
        <p className="muted">No farms yet. Add your first farm below, or try the demo farm.</p>
      )}
      {data && data.farms.length > 0 && (
        <ul className="farm-cards">
          {data.farms.map((farm) => (
            <li key={farm.id} className="farm-card">
              <Link to={`/farms/${farm.id}`} className="farm-card__link">
                <span className="farm-card__icon" aria-hidden="true">
                  <Icon name="farms" size={28} />
                </span>
                <strong>{farm.name}</strong> <span className="muted">{farm.postcode}</span>
                {farm.myRole && farm.myRole !== 'OWNER' && (
                  <span className="pill">{ROLE_LABELS[farm.myRole]}</span>
                )}
              </Link>
              <div className="farm-card__actions">
                <Link
                  to={`/farms/${farm.id}/briefing`}
                  className="button"
                  aria-label={`Briefing for ${farm.name}`}
                >
                  Briefing
                </Link>
                <Link
                  to={`/farms/${farm.id}/map`}
                  className="button button--secondary"
                  aria-label={`Map of ${farm.name}`}
                >
                  Map
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="demo-card" aria-labelledby="demo-heading">
        <div>
          <h2 id="demo-heading">Try a demo farm</h2>
          <p className="muted">
            A hill farm with five fields, sheep and cattle, a season of births, losses, weights, egg
            counts and treatments, tasks and a medicine cabinet, near any postcode you choose.
          </p>
        </div>
        <form className="demo-card__form" onSubmit={handleDemo} aria-label="Create a demo farm">
          <label>
            Postcode for the demo
            <input
              value={demoPostcode}
              onChange={(e) => setDemoPostcode(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={demoState.loading}>
            {demoState.loading ? 'Building the farm…' : 'Create the demo farm'}
          </button>
          {demoError && (
            <p className="error" role="alert">
              {demoError}
            </p>
          )}
        </form>
      </section>

      <h2>Add a farm</h2>
      <form className="form" onSubmit={handleCreate} aria-label="Add farm">
        <label>
          Farm name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Main postcode
          <input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            autoComplete="postal-code"
            required
          />
        </label>
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit">Add farm</button>
      </form>
    </section>
  );
}

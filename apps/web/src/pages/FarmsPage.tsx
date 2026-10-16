import { useMutation, useQuery } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../errors';
import { CREATE_FARM, FARMS_QUERY } from '../graphql/farms';
import type { FarmSummary } from '../types';

/** FR-2.1: the signed-in user's farms, and a form to add one. */
export function FarmsPage() {
  const { data, loading, error } = useQuery<{ farms: FarmSummary[] }>(FARMS_QUERY);
  const [createFarm] = useMutation(CREATE_FARM, { refetchQueries: [{ query: FARMS_QUERY }] });

  const [name, setName] = useState('');
  const [postcode, setPostcode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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

      {loading && <p aria-live="polite">Loading farms…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && data.farms.length === 0 && (
        <p className="muted">No farms yet. Add your first farm below.</p>
      )}
      {data && data.farms.length > 0 && (
        <ul className="list">
          {data.farms.map((farm) => (
            <li key={farm.id}>
              <Link to={`/farms/${farm.id}`} className="list__link">
                <strong>{farm.name}</strong> <span className="muted">{farm.postcode}</span>
              </Link>
              <Link
                to={`/farms/${farm.id}/briefing`}
                className="button"
                aria-label={`Briefing for ${farm.name}`}
              >
                Briefing
              </Link>
            </li>
          ))}
        </ul>
      )}

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

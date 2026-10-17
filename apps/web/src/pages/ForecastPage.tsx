import { useQuery } from '@apollo/client';
import { PageHero } from '../components/photos';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ForecastView } from '../components/ForecastView';
import { FORECAST_QUERY } from '../graphql/queries';
import type { Forecast } from '../types';

export function ForecastPage() {
  const { kind } = useParams<{ kind: 'pet' | 'farm' }>();
  const [params, setParams] = useSearchParams();
  const postcode = params.get('postcode') ?? '';
  const highExposure = params.get('exposure') === '1';
  const isPet = kind !== 'farm';

  const { data, loading, error } = useQuery<{ forecast: Forecast }>(FORECAST_QUERY, {
    variables: { postcode, category: isPet ? 'PET' : 'FARM', highExposureHabitat: highExposure },
    skip: !postcode,
  });

  function toggleExposure(checked: boolean) {
    const next = new URLSearchParams(params);
    if (checked) next.set('exposure', '1');
    else next.delete('exposure');
    setParams(next, { replace: true });
  }

  return (
    <section>
      <PageHero photo={isPet ? 'dog' : 'storm'} eyebrow="14-day forecast">
        <div>
          <h1>{isPet ? 'Pet forecast' : 'Farm forecast'}</h1>
          {postcode && <p>For {postcode.toUpperCase()}</p>}
        </div>
      </PageHero>

      {isPet && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={highExposure}
            onChange={(e) => toggleExposure(e.target.checked)}
          />
          Walks in long grass or woodland
        </label>
      )}

      {!postcode && (
        <p>
          No postcode given. <Link to="/">Enter one on the home page.</Link>
        </p>
      )}
      {loading && <p aria-live="polite">Loading forecast…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {data && <ForecastView forecast={data.forecast} />}
    </section>
  );
}

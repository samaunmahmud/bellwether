import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';

type Role = 'pet' | 'farm';

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'outlook',
    title: '14-day risk forecast',
    text: 'Heat stress, flystrike, ticks, lamb chill and fluke for each group, from the weather where they graze.',
  },
  {
    icon: 'briefing',
    title: 'Morning briefing',
    text: 'One page (or email) with what changed overnight, what’s overdue and the checks worth doing.',
  },
  {
    icon: 'register',
    title: 'Holding register',
    text: 'Births, deaths, moves on and off, tag replacements and the 1 December count, with running totals.',
  },
  {
    icon: 'medicine',
    title: 'Medicine book and cabinet',
    text: 'Treatments with withdrawal dates, expiry warnings and an audit-ready export.',
  },
  {
    icon: 'map',
    title: 'Farm map and grazing',
    text: 'Fields on a map with how long each has been grazed or rested.',
  },
  {
    icon: 'scale',
    title: 'Growth and health',
    text: 'Weights with daily gain, worm egg counts and condition scores, charted per group.',
  },
  {
    icon: 'people',
    title: 'Shared with your team',
    text: 'Invite workers and viewers, assign tasks and see who recorded what.',
  },
  {
    icon: 'pets',
    title: 'Pets too',
    text: 'Tick and heat risk for dogs and cats, a health plan, weight chart and walk planner.',
  },
];

/** The cells of the preview card: a week of made-up levels, purely illustrative. */
const PREVIEW = [
  ['Ewes · flystrike', 'MMHHHMM'],
  ['Lambs · flystrike', 'MHHHHHM'],
  ['Cows · heat stress', 'LLMMLLL'],
  ['Calves · fluke', 'LLLMMMM'],
] as const;
const LEVEL = { L: 'low', M: 'medium', H: 'high' } as const;

export function HomePage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('farm');
  const [postcode, setPostcode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = postcode.trim();
    if (!trimmed) return;
    navigate(`/forecast/${role}?postcode=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="landing">
      <section className="landing__hero">
        <div>
          <p className="eyebrow">For UK livestock farms and pet owners</p>
          <h1>Animal health risk, 14 days ahead</h1>
          <p className="lead">
            Bellwether turns the weather forecast into plain-English risk for your animals, and
            keeps the records that go with it: register, medicine book, tasks and more.
          </p>

          <form className="form hero-form" onSubmit={handleSubmit}>
            <fieldset className="segmented">
              <legend>I'm a…</legend>
              <label className={role === 'farm' ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="role"
                  value="farm"
                  checked={role === 'farm'}
                  onChange={() => setRole('farm')}
                />
                Farmer
              </label>
              <label className={role === 'pet' ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="role"
                  value="pet"
                  checked={role === 'pet'}
                  onChange={() => setRole('pet')}
                />
                Pet owner
              </label>
            </fieldset>

            <div className="hero-form__row">
              <label>
                Postcode
                <input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="e.g. LA9 4DQ"
                  autoComplete="postal-code"
                  required
                />
              </label>
              <button type="submit">See forecast</button>
            </div>
          </form>
          <p className="muted">
            Free to try, no account needed for the forecast.{' '}
            <Link to="/signup">Create an account</Link> to add your farm or try the demo farm.
          </p>
        </div>

        <figure className="preview" aria-label="Example: a week of risk for four groups">
          <figcaption>
            <strong>This week</strong>
            <span className="muted">Example farm</span>
          </figcaption>
          <table className="heatmap__table">
            <tbody>
              {PREVIEW.map(([label, levels]) => (
                <tr key={label}>
                  <th scope="row" className="heatmap__label">
                    {label}
                  </th>
                  {[...levels].map((l, i) => (
                    <td key={i} className="heatmap__cell-wrap">
                      <span
                        className={`heatmap__cell heatmap__cell--${LEVEL[l as keyof typeof LEVEL]}`}
                      >
                        {l}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="preview__note">
            <span className="badge badge--high">High</span> Warm and humid: blowfly strike risk
            high. Check the flock daily.
          </p>
        </figure>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="landing__h2">
          Everything a small farm keeps track of, in one place
        </h2>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.title} className="feature">
              <span className="feature__icon" aria-hidden="true">
                <Icon name={f.icon} size={24} />
              </span>
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="disclaimer">
        Bellwether is an awareness tool, not veterinary advice. Risk levels come from simple weather
        rules of thumb, not from examining your animals. Speak to your vet.
      </p>
    </div>
  );
}

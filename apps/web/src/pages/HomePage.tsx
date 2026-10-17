import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { LiveConditions } from '../components/LiveConditions';
import { Photo } from '../components/photos';

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
        <Photo name="fell" className="photo--drift" />
        <div className="landing__copy">
          <p className="eyebrow">For UK livestock farms and pet owners</p>
          <h1>Animal health risk, 14 days ahead</h1>
          <p className="lead">
            Bellwether turns the weather forecast into plain-English risk for your animals, and
            keeps the records that go with it: register, medicine book, tasks and more.
          </p>

          <form className="form hero-form hero-card" onSubmit={handleSubmit}>
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
            <p className="muted hero-card__note">
              No account needed for the forecast. <Link to="/login">Explore a demo account</Link> or{' '}
              <Link to="/signup">sign up</Link> to add your farm.
            </p>
          </form>
        </div>

        <div className="landing__live">
          <LiveConditions postcode="LA9 4DQ" place="Kendal, Cumbria" />
        </div>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="landing__h2">
          Everything a small farm keeps track of, in one place
        </h2>
        <ul className="features">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="feature" style={{ ['--i' as string]: i }}>
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

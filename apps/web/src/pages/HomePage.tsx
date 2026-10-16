import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

type Role = 'pet' | 'farm';

export function HomePage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('pet');
  const [postcode, setPostcode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = postcode.trim();
    if (!trimmed) return;
    navigate(`/forecast/${role}?postcode=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="hero">
      <h1>Animal health risk, 14 days ahead</h1>
      <p className="lead">
        Enter a UK postcode to see how the coming weather affects tick, heat and flystrike risk for
        your animals.
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <fieldset className="segmented">
          <legend>I'm a…</legend>
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
        </fieldset>

        <label>
          Postcode
          <input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="e.g. UB8 3PH"
            autoComplete="postal-code"
            required
          />
        </label>

        <button type="submit">See forecast</button>
      </form>
    </section>
  );
}

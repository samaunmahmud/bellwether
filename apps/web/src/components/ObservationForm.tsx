import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';
import type { Species } from '../types';

export interface ObservationFormValues {
  date: string;
  type: string;
  note: string | null;
}

// General husbandry checks only.
const CHECKS: Record<Species, string[]> = {
  SHEEP: [
    'Flock inspected',
    'Checked for flystrike',
    'Feet checked',
    'Lambs checked',
    'Water checked',
    'Other',
  ],
  CATTLE: ['Herd inspected', 'Feet checked', 'Shade and water checked', 'Calves checked', 'Other'],
};

/** FR-6.6: record a check or observation against a group. */
export function ObservationForm({
  species,
  onSubmit,
}: {
  species: Species;
  onSubmit: (values: ObservationFormValues) => Promise<unknown>;
}) {
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState(CHECKS[species][0]!);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ date, type, note: note.trim() || null });
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Record check">
      <div className="form--inline">
        <label>
          Date
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          Check
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {CHECKS[species].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        What you found
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. 2 struck ewes found"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Record check</button>
    </form>
  );
}

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

/**
 * FR-6.6: record a check or observation against a group.
 * With `initial`, it corrects an existing check and asks why (FR-6.5).
 */
export function ObservationForm({
  species,
  onSubmit,
  initial,
  onCancel,
}: {
  species: Species;
  onSubmit: (values: ObservationFormValues, changeReason?: string) => Promise<unknown>;
  initial?: ObservationFormValues;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [type, setType] = useState(initial?.type ?? CHECKS[species][0]!);
  const [note, setNote] = useState(initial?.note ?? '');
  const [changeReason, setChangeReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const checks = CHECKS[species].includes(type) ? CHECKS[species] : [type, ...CHECKS[species]];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const values = { date, type, note: note.trim() || null };
      if (initial) {
        await onSubmit(values, changeReason.trim());
        return;
      }
      await onSubmit(values);
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form
      className="form"
      onSubmit={handleSubmit}
      aria-label={initial ? 'Correct check' : 'Record check'}
    >
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
            {checks.map((c) => (
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
      {initial && (
        <label>
          Why are you correcting this?
          <input
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Kept in the record's history"
            required
          />
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">{initial ? 'Save correction' : 'Record check'}</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';

export interface LogFormValues {
  date: string;
  type: string;
  note: string | null;
  nextDueDate: string | null;
  /** v3: only sent when a weight is typed, or cleared from an entry that had one */
  weightKg?: number | null;
}

export const LOG_TYPES = [
  'Tick check',
  'Treatment given',
  'Flea check',
  'Groomed',
  'Weighed',
  'Vaccination',
  'Worming',
  'Vet visit',
  'Other',
];

interface Props {
  onSubmit: (values: LogFormValues) => unknown;
  /** An existing entry to edit; the form starts from its values and isn't cleared on save. */
  initial?: LogFormValues;
  submitLabel?: string;
  onCancel?: () => void;
}

export function LogForm({ onSubmit, initial, submitLabel = 'Add entry', onCancel }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [type, setType] = useState(initial?.type ?? LOG_TYPES[0]!);
  const [note, setNote] = useState(initial?.note ?? '');
  const [nextDueDate, setNextDueDate] = useState(initial?.nextDueDate ?? '');
  const [weight, setWeight] = useState(initial?.weightKg == null ? '' : String(initial.weightKg));
  const [error, setError] = useState<string | null>(null);
  // Older entries may have a type that is no longer in the list; keep it selectable.
  const types = LOG_TYPES.includes(type) ? LOG_TYPES : [type, ...LOG_TYPES];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (nextDueDate && nextDueDate < date) {
      setError('Next due date must be on or after the log date');
      return;
    }
    setError(null);
    try {
      const hadWeight = initial?.weightKg != null;
      await onSubmit({
        date,
        type,
        note: note.trim() || null,
        nextDueDate: nextDueDate || null,
        ...(weight !== '' || hadWeight ? { weightKg: weight === '' ? null : Number(weight) } : {}),
      });
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    if (!initial) {
      setNote('');
      setNextDueDate('');
      setWeight('');
    }
  }

  return (
    <form
      className="form form--inline"
      onSubmit={handleSubmit}
      aria-label={initial ? 'Edit log entry' : 'Add log entry'}
    >
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </label>
      <label>
        Next due
        <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
      </label>
      <label>
        Weight (kg)
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Optional"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">{submitLabel}</button>
      {onCancel && (
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}

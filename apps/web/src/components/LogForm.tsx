import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';

export interface LogFormValues {
  date: string;
  type: string;
  note: string | null;
  nextDueDate: string | null;
}

export const LOG_TYPES = [
  'Tick check',
  'Treatment given',
  'Flea check',
  'Groomed',
  'Weighed',
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
      await onSubmit({ date, type, note: note.trim() || null, nextDueDate: nextDueDate || null });
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    if (!initial) {
      setNote('');
      setNextDueDate('');
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

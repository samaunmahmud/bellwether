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
  'Flock inspected',
  'Herd check',
  'Vet visit',
  'Other',
];

export function LogForm({ onSubmit }: { onSubmit: (values: LogFormValues) => unknown }) {
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState(LOG_TYPES[0]!);
  const [note, setNote] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (nextDueDate && nextDueDate < date) {
      setError('Next due date must be on or after the log date');
      return;
    }
    setError(null);
    await onSubmit({ date, type, note: note.trim() || null, nextDueDate: nextDueDate || null });
    setNote('');
    setNextDueDate('');
  }

  return (
    <form className="form form--inline" onSubmit={handleSubmit} aria-label="Add log entry">
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {LOG_TYPES.map((t) => (
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
      <button type="submit">Add entry</button>
    </form>
  );
}

import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';
import type { FieldOption } from '../types';

interface Props {
  groupName: string;
  fields: FieldOption[];
  currentFieldId: string | null;
  onSubmit: (values: { toFieldId: string; movedOn: string }) => Promise<unknown>;
}

/** FR-2.4: record a move to another field, with the date it happened. */
export function MoveGroupForm({ groupName, fields, currentFieldId, onSubmit }: Props) {
  const options = fields.filter((f) => f.id !== currentFieldId);
  const [toFieldId, setToFieldId] = useState(options[0]?.id ?? '');
  const [movedOn, setMovedOn] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return <p className="muted">Add another field to move this group.</p>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ toFieldId: toFieldId || options[0]!.id, movedOn });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form form--inline" onSubmit={handleSubmit} aria-label={`Move ${groupName}`}>
      <label>
        Move {groupName} to
        <select value={toFieldId} onChange={(e) => setToFieldId(e.target.value)}>
          {options.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Moved on
        <input
          type="date"
          value={movedOn}
          max={todayIso()}
          onChange={(e) => setMovedOn(e.target.value)}
          required
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Move</button>
    </form>
  );
}

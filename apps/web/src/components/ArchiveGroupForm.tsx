import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';

export interface ArchiveValues {
  archivedOn: string;
  reason: string;
}

/** For a group that has been sold or finished. Its records are kept. */
export function ArchiveGroupForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: ArchiveValues) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [archivedOn, setArchivedOn] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ archivedOn, reason: reason.trim() });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Archive group">
      <p className="muted">
        Archived groups leave the farm page and the briefing. Their treatments, checks and moves
        stay on record, and you can restore them from Farm settings.
      </p>
      <div className="form--inline">
        <label>
          Date
          <input
            type="date"
            value={archivedOn}
            max={todayIso()}
            onChange={(e) => setArchivedOn(e.target.value)}
            required
          />
        </label>
        <label>
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Sold at market"
            required
          />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">Archive</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

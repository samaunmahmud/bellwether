import { useState, type FormEvent } from 'react';
import { errorMessage } from '../errors';

/** FR-6.5: asks why a record is being voided. Records are never deleted. */
export function VoidForm({
  onVoid,
  onCancel,
}: {
  onVoid: (reason: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onVoid(reason.trim());
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Void record">
      <p className="muted">
        A voided record stays in your records, marked as void, and no longer counts for withdrawal.
      </p>
      <label>
        Why void this record?
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Entered twice"
          required
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="danger">
          Void record
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

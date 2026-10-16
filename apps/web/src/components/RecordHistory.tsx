import type { RecordRevision } from '../types';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });

/** FR-6.5: a record's corrections and voids, collapsed until opened. */
export function RecordHistory({ history }: { history: RecordRevision[] }) {
  if (history.length === 0) return null;
  return (
    <details className="history">
      <summary>History ({history.length})</summary>
      <ol className="history__list">
        {history.map((r) => (
          <li key={r.id}>
            <p>
              <strong>
                {r.action === 'VOIDED' ? 'Voided' : 'Corrected'} by {r.by}
              </strong>{' '}
              · {when(r.at)} · &ldquo;{r.reason}&rdquo;
            </p>
            {r.changes.length > 0 && (
              <ul>
                {r.changes.map((c) => (
                  <li key={c.field}>
                    {c.field}: {c.from ?? '(blank)'} → {c.to ?? '(blank)'}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

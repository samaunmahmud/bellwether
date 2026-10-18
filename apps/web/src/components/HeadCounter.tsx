import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { tallyVerdict } from '../camera';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';
import { RECORD_OBSERVATION } from '../graphql/records';

interface Group {
  id: string;
  name: string;
  headCount: number;
}

/**
 * v4.2: count a group by tapping once per animal (e.g. as they go through a gate), compare it
 * with the head count on record, and save the check as an observation.
 */
export function HeadCounter({ groups, canSave }: { groups: Group[]; canSave: boolean }) {
  const [groupId, setGroupId] = useState('');
  const [count, setCount] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordObservation, { loading }] = useMutation(RECORD_OBSERVATION);
  const group = groups.find((g) => g.id === groupId);
  const verdict = group ? tallyVerdict(count, group.headCount) : null;
  const matches = group ? count === group.headCount : false;

  const change = (by: number) => {
    setSaved(null);
    setCount((c) => Math.max(0, c + by));
  };

  async function save() {
    if (!group) return;
    setError(null);
    const lowered = verdict!.charAt(0).toLowerCase() + verdict!.slice(1);
    try {
      await recordObservation({
        variables: {
          input: {
            groupId: group.id,
            date: todayIso(),
            type: 'Head count check',
            note: `Counted ${count} of ${group.headCount}: ${lowered}`,
          },
        },
      });
      setSaved(`Saved to ${group.name}’s records`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="panel tally" aria-label="Count animals">
      <h2>Count animals</h2>
      <p className="muted">
        Tap once for each animal, e.g. as they come through a gate, then compare with the head count
        on record.
      </p>
      <label>
        Group
        <select
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            setCount(0);
            setSaved(null);
          }}
        >
          <option value="">Choose a group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.headCount} on record)
            </option>
          ))}
        </select>
      </label>
      <div className="tally__pad">
        <button
          type="button"
          className="tally__one"
          onClick={() => change(1)}
          aria-label="Count one"
        >
          <span className="tally__number">{count}</span>
          <span>Tap to count</span>
        </button>
        <div className="tally__side">
          <button
            type="button"
            className="secondary"
            onClick={() => change(-1)}
            aria-label="Take one off"
            disabled={count === 0}
          >
            −1
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setCount(0);
              setSaved(null);
            }}
            disabled={count === 0}
          >
            Start again
          </button>
        </div>
      </div>
      <p role="status" className="tally__status">
        {group ? `${count} of ${group.headCount}` : `${count} counted`}
      </p>
      {verdict && <p className={`badge ${matches ? 'badge--low' : 'badge--medium'}`}>{verdict}</p>}
      {group && canSave && (
        <button type="button" onClick={save} disabled={loading || count === 0}>
          Save this count
        </button>
      )}
      {saved && <p className="success">{saved}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

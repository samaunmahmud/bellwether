import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';

export interface TaskFormValues {
  title: string;
  dueDate: string;
  /** Null for the whole farm */
  groupId: string | null;
  note: string | null;
  repeatEveryDays: number | null;
}

const REPEATS: Array<{ label: string; days: number | null }> = [
  { label: 'Does not repeat', days: null },
  { label: 'Every day', days: 1 },
  { label: 'Every week', days: 7 },
  { label: 'Every 2 weeks', days: 14 },
  { label: 'Every 4 weeks', days: 28 },
];
const CUSTOM = 'custom';

const presetValue = (days: number | null) =>
  REPEATS.some((r) => r.days === days) ? String(days ?? '') : CUSTOM;

/** FR-5.3: add or edit a task for a group or the whole farm, optionally repeating. */
export function TaskForm({
  groups,
  onSubmit,
  initial,
  onCancel,
}: {
  groups: Array<{ id: string; name: string }>;
  onSubmit: (values: TaskFormValues) => Promise<unknown>;
  initial?: TaskFormValues;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? todayIso());
  const [groupId, setGroupId] = useState(initial?.groupId ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [repeat, setRepeat] = useState(presetValue(initial?.repeatEveryDays ?? null));
  const [customDays, setCustomDays] = useState(String(initial?.repeatEveryDays ?? ''));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const repeatEveryDays =
      repeat === CUSTOM ? Number(customDays) : repeat === '' ? null : Number(repeat);
    try {
      await onSubmit({
        title: title.trim(),
        dueDate,
        groupId: groupId || null,
        note: note.trim() || null,
        repeatEveryDays,
      });
      if (!initial) {
        setTitle('');
        setNote('');
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label={initial ? 'Edit task' : 'Add task'}>
      <div className="form--inline">
        <label>
          Task
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Check water troughs"
            required
          />
        </label>
        <label>
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </label>
        <label>
          For
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Whole farm</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repeat
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {REPEATS.map((r) => (
              <option key={r.label} value={String(r.days ?? '')}>
                {r.label}
              </option>
            ))}
            <option value={CUSTOM}>Every … days</option>
          </select>
        </label>
        {repeat === CUSTOM && (
          <label>
            Repeat every (days)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              required
            />
          </label>
        )}
      </div>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">{initial ? 'Save task' : 'Add task'}</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

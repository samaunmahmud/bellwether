import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';
import type { RegisterEventKind } from '../types';

export interface RegisterEventValues {
  groupId: string;
  kind: RegisterEventKind;
  date: string;
  count: number | null;
  bornDead: number | null;
  value: number | null;
  otherParty: string | null;
  reference: string | null;
  cause: string | null;
  note: string | null;
}

type Field = 'count' | 'bornDead' | 'value' | 'otherParty' | 'reference' | 'cause';

interface KindSpec {
  label: string;
  /** Label for each field this kind uses */
  fields: Partial<Record<Field, string>>;
  required: Field[];
  /** For the value field */
  step?: string;
  min?: number;
  max?: number;
}

/** What each kind of entry asks for, in plain words. */
export const KINDS: Record<RegisterEventKind, KindSpec> = {
  BIRTH: {
    label: 'Births',
    fields: { count: 'Born alive', bornDead: 'Born dead' },
    required: [],
  },
  DEATH: {
    label: 'Death or loss',
    fields: {
      count: 'Animals',
      cause: 'Cause, if known',
      reference: 'Fallen stock collection ref',
    },
    required: ['count'],
  },
  MOVE_ON: {
    label: 'Moved on',
    fields: {
      count: 'Animals',
      otherParty: 'Came from (holding, CPH or market)',
      reference: 'Movement reference',
    },
    required: ['count', 'otherParty'],
  },
  MOVE_OFF: {
    label: 'Moved off',
    fields: {
      count: 'Animals',
      otherParty: 'Went to (holding, market or abattoir)',
      reference: 'Movement reference',
    },
    required: ['count', 'otherParty'],
  },
  WEIGHING: {
    label: 'Weighing',
    fields: { count: 'Animals weighed', value: 'Average weight (kg)' },
    required: ['count', 'value'],
    step: '0.1',
    min: 0.1,
  },
  FEC: {
    label: 'Worm egg count',
    fields: { count: 'Samples', value: 'Eggs per gram', reference: 'Lab reference' },
    required: ['count', 'value'],
    step: '1',
    min: 0,
  },
  BODY_CONDITION: {
    label: 'Condition score',
    fields: { count: 'Animals scored', value: 'Average score (1–5)' },
    required: ['count', 'value'],
    step: '0.25',
    min: 1,
    max: 5,
  },
  TAG_REPLACEMENT: {
    label: 'Tags replaced',
    fields: { count: 'Tags replaced' },
    required: ['count'],
  },
  HEAD_COUNT: {
    label: 'Head count',
    fields: { count: 'Animals counted' },
    required: ['count'],
  },
};

export const KIND_ORDER = Object.keys(KINDS) as RegisterEventKind[];

const numberOrNull = (text: string) => (text.trim() === '' ? null : Number(text));
const textOrNull = (text: string) => text.trim() || null;

/** v3: records a birth, death, move, measurement or count for a group. */
export function RegisterEventForm({
  groups,
  initialKind = 'DEATH',
  initialGroupId,
  onSubmit,
  onCancel,
}: {
  groups: Array<{ id: string; name: string; headCount: number }>;
  initialKind?: RegisterEventKind;
  initialGroupId?: string;
  onSubmit: (values: RegisterEventValues) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<RegisterEventKind>(initialKind);
  const [groupId, setGroupId] = useState(initialGroupId ?? groups[0]?.id ?? '');
  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState<Record<Field, string>>({
    count: '',
    bornDead: '',
    value: '',
    otherParty: '',
    reference: '',
    cause: '',
  });
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const spec = KINDS[kind];
  const group = groups.find((g) => g.id === groupId);

  const set = (field: Field, value: string) => setValues((v) => ({ ...v, [field]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pick = <T,>(field: Field, convert: (s: string) => T) =>
      field in spec.fields ? convert(values[field]) : null;
    try {
      await onSubmit({
        groupId,
        kind,
        date,
        count: pick('count', numberOrNull),
        bornDead: pick('bornDead', numberOrNull),
        value: pick('value', numberOrNull),
        otherParty: pick('otherParty', textOrNull),
        reference: pick('reference', textOrNull),
        cause: pick('cause', textOrNull),
        note: textOrNull(note),
      });
      setValues({ count: '', bornDead: '', value: '', otherParty: '', reference: '', cause: '' });
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (groups.length === 0)
    return <p className="empty">Add a livestock group first, then record entries against it.</p>;

  return (
    <form className="form register-form" aria-label="Record an entry" onSubmit={handleSubmit}>
      <fieldset className="chips">
        <legend>What happened?</legend>
        {KIND_ORDER.map((k) => (
          <label key={k} className={k === kind ? 'chip is-active' : 'chip'}>
            <input
              type="radio"
              name="kind"
              value={k}
              checked={k === kind}
              onChange={() => setKind(k)}
            />
            {KINDS[k].label}
          </label>
        ))}
      </fieldset>
      <div className="form--inline">
        <label>
          Group
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.headCount})
              </option>
            ))}
          </select>
        </label>
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
        {(Object.entries(spec.fields) as Array<[Field, string]>).map(([field, label]) => {
          const numeric = field === 'count' || field === 'bornDead' || field === 'value';
          return (
            <label key={field}>
              {label}
              <input
                type={numeric ? 'number' : 'text'}
                inputMode={numeric ? (field === 'value' ? 'decimal' : 'numeric') : undefined}
                min={field === 'value' ? spec.min : 0}
                max={
                  field === 'value'
                    ? spec.max
                    : field === 'count' && (kind === 'DEATH' || kind === 'MOVE_OFF')
                      ? group?.headCount
                      : undefined
                }
                step={field === 'value' ? spec.step : '1'}
                value={values[field]}
                onChange={(e) => set(field, e.target.value)}
                required={spec.required.includes(field)}
              />
            </label>
          );
        })}
      </div>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </label>
      {(kind === 'DEATH' ||
        kind === 'MOVE_OFF' ||
        kind === 'MOVE_ON' ||
        kind === 'BIRTH' ||
        kind === 'HEAD_COUNT') && (
        <p className="muted">
          {kind === 'HEAD_COUNT'
            ? "Sets the group's head count to the number counted."
            : `Updates ${group?.name ?? 'the group'}'s head count automatically.`}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">Save {KINDS[kind].label.toLowerCase()}</button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

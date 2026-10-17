import { useState, type FormEvent } from 'react';
import { todayIso } from '../dates';
import { errorMessage } from '../errors';
import type { AnimalSex, AnimalStatus, Species, TaggedAnimal } from '../types';

export const SEX_LABELS: Record<AnimalSex, string> = {
  FEMALE: 'Female',
  MALE: 'Male (entire)',
  CASTRATED: 'Castrated',
};

export const STATUS_LABELS: Record<AnimalStatus, string> = {
  ON_FARM: 'On the farm',
  SOLD: 'Sold',
  DIED: 'Died',
};

export interface TaggedValues {
  tag: string;
  name: string | null;
  species: Species;
  sex: AnimalSex;
  breed: string | null;
  dateOfBirth: string | null;
  groupId: string | null;
  notes: string | null;
  /** Only sent when editing */
  status?: AnimalStatus;
  statusDate?: string | null;
}

type Group = { id: string; name: string; species: Species };

/** v4: add or change one tagged animal. Species is fixed once added. Empty boxes are sent as null. */
export function TaggedAnimalForm({
  initial,
  groups,
  onSubmit,
  onCancel,
}: {
  initial?: TaggedAnimal;
  groups: Group[];
  onSubmit: (values: TaggedValues) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [v, setV] = useState({
    tag: initial?.tag ?? '',
    name: initial?.name ?? '',
    species: initial?.species ?? ('SHEEP' as Species),
    sex: initial?.sex ?? ('FEMALE' as AnimalSex),
    breed: initial?.breed ?? '',
    dateOfBirth: initial?.dateOfBirth ?? '',
    groupId: initial?.group?.id ?? '',
    notes: initial?.notes ?? '',
    status: initial?.status ?? ('ON_FARM' as AnimalStatus),
    statusDate: initial?.statusDate ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) =>
    setV((old) => ({ ...old, [key]: value }));
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  const sameSpecies = groups.filter((g) => g.species === v.species);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({
        tag: v.tag.trim(),
        name: orNull(v.name),
        species: v.species,
        sex: v.sex,
        breed: orNull(v.breed),
        dateOfBirth: orNull(v.dateOfBirth),
        groupId: v.groupId || null,
        notes: orNull(v.notes),
        ...(initial && {
          status: v.status,
          statusDate: v.status === 'ON_FARM' ? null : orNull(v.statusDate),
        }),
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form panel tagged-form" onSubmit={handleSubmit} aria-label="Animal">
      <div className="form--inline">
        <label>
          Ear tag or ID
          <input
            value={v.tag}
            onChange={(e) => set('tag', e.target.value)}
            placeholder="e.g. UK 123456 700001"
            required
          />
        </label>
        <label>
          Name
          <input
            value={v.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          Species
          <select
            value={v.species}
            disabled={Boolean(initial)}
            onChange={(e) => {
              set('species', e.target.value as Species);
              set('groupId', '');
            }}
          >
            <option value="SHEEP">Sheep</option>
            <option value="CATTLE">Cattle</option>
          </select>
        </label>
        <label>
          Sex
          <select value={v.sex} onChange={(e) => set('sex', e.target.value as AnimalSex)}>
            {Object.entries(SEX_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Breed
          <input
            value={v.breed}
            onChange={(e) => set('breed', e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          Date of birth
          <input
            type="date"
            value={v.dateOfBirth}
            max={todayIso()}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </label>
        <label>
          Group
          <select value={v.groupId} onChange={(e) => set('groupId', e.target.value)}>
            <option value="">No group</option>
            {sameSpecies.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        {initial && (
          <>
            <label>
              Status
              <select
                value={v.status}
                onChange={(e) => set('status', e.target.value as AnimalStatus)}
              >
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {v.status !== 'ON_FARM' && (
              <label>
                {v.status === 'SOLD' ? 'Date sold' : 'Date died'}
                <input
                  type="date"
                  value={v.statusDate}
                  max={todayIso()}
                  onChange={(e) => set('statusDate', e.target.value)}
                  required
                />
              </label>
            )}
          </>
        )}
      </div>
      <label>
        Notes
        <input
          value={v.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="e.g. bought in, dam's tag, temperament"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit">Save animal</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

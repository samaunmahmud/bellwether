import { useState, type FormEvent } from 'react';
import { formatAge, fullDate, monthsBetween, todayIso } from '../dates';
import { errorMessage } from '../errors';
import type { Pet } from '../types';

export interface PetDetails {
  dateOfBirth: string | null;
  breed: string | null;
  sex: string | null;
  microchip: string | null;
}

/** "985112000123456" → "985 112 000 123 456" */
const groupDigits = (digits: string) => digits.replace(/(\d{3})(?=\d)/g, '$1 ');

/** v4: the details a vet, groomer or kennel asks for. Empty boxes clear a detail. */
export function PetRecordCard({
  pet,
  onSave,
}: {
  pet: Pick<Pet, 'name' | 'dateOfBirth' | 'breed' | 'sex' | 'microchip'>;
  onSave: (details: PetDetails) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({
    dateOfBirth: pet.dateOfBirth ?? '',
    breed: pet.breed ?? '',
    sex: pet.sex ?? '',
    microchip: pet.microchip ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof v, value: string) => setV((old) => ({ ...old, [key]: value }));
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  const empty = !pet.dateOfBirth && !pet.breed && !pet.sex && !pet.microchip;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSave({
        dateOfBirth: orNull(v.dateOfBirth),
        breed: orNull(v.breed),
        sex: orNull(v.sex),
        microchip: orNull(v.microchip),
      });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const rows: Array<[string, string | null]> = [
    [
      'Born',
      pet.dateOfBirth
        ? `${fullDate(pet.dateOfBirth)} (${formatAge(monthsBetween(pet.dateOfBirth, todayIso()))})`
        : null,
    ],
    ['Breed', pet.breed],
    ['Sex', pet.sex],
    ['Microchip', pet.microchip ? groupDigits(pet.microchip) : null],
  ];

  return (
    <section className="panel pet-record" aria-label="Record card">
      <div className="pet-record__head">
        <h2>Record card</h2>
        {!editing && (
          <button
            type="button"
            className="link-button"
            aria-label="Edit record card"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <form className="form" onSubmit={handleSubmit} aria-label="Record card">
          <div className="form--inline">
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
              Breed
              <input value={v.breed} onChange={(e) => set('breed', e.target.value)} />
            </label>
            <label>
              Sex
              <input
                value={v.sex}
                onChange={(e) => set('sex', e.target.value)}
                placeholder="e.g. Female (spayed)"
              />
            </label>
            <label>
              Microchip number
              <input
                inputMode="numeric"
                value={v.microchip}
                onChange={(e) => set('microchip', e.target.value)}
                placeholder="15 digits"
              />
            </label>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit">Save</button>
            <button type="button" className="secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : empty ? (
        <p className="muted">
          Not recorded yet. Add {pet.name}&apos;s date of birth, breed and microchip number so
          they&apos;re to hand at the vet or kennels.
        </p>
      ) : (
        <dl className="pet-record__list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? '–'}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

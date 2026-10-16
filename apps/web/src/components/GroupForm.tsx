import { useState, type FormEvent } from 'react';
import { errorMessage } from '../errors';
import type { CattleType, FieldOption, LivestockClass, Species } from '../types';

export const CLASS_LABELS: Record<LivestockClass, string> = {
  EWES: 'Ewes',
  LAMBS: 'Lambs',
  RAMS: 'Rams',
  DAIRY_COWS: 'Dairy cows',
  BEEF_CATTLE: 'Beef cattle',
  CALVES: 'Calves',
};

const CLASSES: Record<Species, LivestockClass[]> = {
  SHEEP: ['EWES', 'LAMBS', 'RAMS'],
  CATTLE: ['DAIRY_COWS', 'BEEF_CATTLE', 'CALVES'],
};

interface BaseValues {
  name: string;
  species: Species;
  livestockClass: LivestockClass;
  headCount: number;
  currentFieldId: string | null;
  housed: boolean;
}

export type GroupFormValues =
  | (BaseValues & {
      species: 'SHEEP';
      lastShearingDate: string | null;
      lambingStart: string | null;
      lambingEnd: string | null;
      lambsAtGrassThisSpring: boolean;
    })
  | (BaseValues & {
      species: 'CATTLE';
      cattleType: CattleType | null;
      calvingStart: string | null;
      calvingEnd: string | null;
    });

const orNull = (value: string) => value || null;

/** Checks an optional period: both dates or neither, and the end on or after the start. */
function periodError(start: string, end: string, label: string): string | null {
  if (!start && !end) return null;
  if (!start || !end) return `${label} needs both a start and an end date`;
  return end < start ? `${label} must end on or after the day it starts` : null;
}

/** FR-2.3, FR-2.5: add a livestock group with the details that matter for its species. */
export function GroupForm({
  fields,
  onSubmit,
}: {
  fields: FieldOption[];
  onSubmit: (values: GroupFormValues) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('SHEEP');
  const [livestockClass, setLivestockClass] = useState<LivestockClass>('EWES');
  const [headCount, setHeadCount] = useState('');
  const [currentFieldId, setCurrentFieldId] = useState('');
  const [housed, setHoused] = useState(false);
  // Sheep
  const [lastShearingDate, setLastShearingDate] = useState('');
  const [lambingStart, setLambingStart] = useState('');
  const [lambingEnd, setLambingEnd] = useState('');
  const [lambsAtGrass, setLambsAtGrass] = useState(false);
  // Cattle
  const [cattleType, setCattleType] = useState<CattleType | ''>('');
  const [calvingStart, setCalvingStart] = useState('');
  const [calvingEnd, setCalvingEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problem =
      species === 'SHEEP'
        ? periodError(lambingStart, lambingEnd, 'Lambing')
        : periodError(calvingStart, calvingEnd, 'Calving');
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    const base = {
      name: name.trim(),
      livestockClass,
      headCount: Number(headCount),
      currentFieldId: orNull(currentFieldId),
      housed,
    };
    const values: GroupFormValues =
      species === 'SHEEP'
        ? {
            ...base,
            species,
            lastShearingDate: orNull(lastShearingDate),
            lambingStart: orNull(lambingStart),
            lambingEnd: orNull(lambingEnd),
            lambsAtGrassThisSpring: lambsAtGrass,
          }
        : {
            ...base,
            species,
            // Dairy cows and beef cattle get this from their class (A6).
            cattleType: livestockClass === 'CALVES' && cattleType ? cattleType : null,
            calvingStart: orNull(calvingStart),
            calvingEnd: orNull(calvingEnd),
          };

    try {
      await onSubmit(values);
      setName('');
      setHeadCount('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Add livestock group">
      <label>
        Group name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. North flock"
          required
        />
      </label>
      <div className="form--inline">
        <label>
          Species
          <select
            value={species}
            onChange={(e) => {
              const next = e.target.value as Species;
              setSpecies(next);
              setLivestockClass(CLASSES[next][0]!);
            }}
          >
            <option value="SHEEP">Sheep</option>
            <option value="CATTLE">Cattle</option>
          </select>
        </label>
        <label>
          Class
          <select
            value={livestockClass}
            onChange={(e) => setLivestockClass(e.target.value as LivestockClass)}
          >
            {CLASSES[species].map((c) => (
              <option key={c} value={c}>
                {CLASS_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Head count
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={headCount}
            onChange={(e) => setHeadCount(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="form--inline">
        <label>
          Field
          <select value={currentFieldId} onChange={(e) => setCurrentFieldId(e.target.value)}>
            <option value="">No field yet</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={housed} onChange={(e) => setHoused(e.target.checked)} />
          Housed
        </label>
      </div>

      {species === 'SHEEP' ? (
        <div className="form--inline">
          <label>
            Last shearing
            <input
              type="date"
              value={lastShearingDate}
              onChange={(e) => setLastShearingDate(e.target.value)}
            />
          </label>
          <label>
            Lambing starts
            <input
              type="date"
              value={lambingStart}
              onChange={(e) => setLambingStart(e.target.value)}
            />
          </label>
          <label>
            Lambing ends
            <input type="date" value={lambingEnd} onChange={(e) => setLambingEnd(e.target.value)} />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={lambsAtGrass}
              onChange={(e) => setLambsAtGrass(e.target.checked)}
            />
            Lambs at grass this spring
          </label>
        </div>
      ) : (
        <div className="form--inline">
          {livestockClass === 'CALVES' && (
            <label>
              Dairy or beef
              <select
                value={cattleType}
                onChange={(e) => setCattleType(e.target.value as CattleType | '')}
              >
                <option value="">Not sure</option>
                <option value="DAIRY">Dairy</option>
                <option value="BEEF">Beef</option>
              </select>
            </label>
          )}
          <label>
            Calving starts
            <input
              type="date"
              value={calvingStart}
              onChange={(e) => setCalvingStart(e.target.value)}
            />
          </label>
          <label>
            Calving ends
            <input type="date" value={calvingEnd} onChange={(e) => setCalvingEnd(e.target.value)} />
          </label>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">Add group</button>
    </form>
  );
}
